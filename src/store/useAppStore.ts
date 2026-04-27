import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { temporal } from "zundo";
import { nanoid } from "nanoid";
import { todayIso } from "../lib/utils";
import { idbStorage } from "./storage";
import { migrate, STORE_VERSION } from "./migrations";
import {
  collectDescendants,
  finalizeTimer,
  getContainer,
  insertAt,
  newTask,
  readContainer,
  removeFromArray,
  scopeKey,
} from "./treeOps";

import { asProjectId, asTaskId } from "../types";
import type {
  ActiveTimer,
  FilterState,
  Project,
  ProjectId,
  Task,
  TaskId,
  TimerSession,
  Theme,
  ViewKey,
} from "../types";

// Re-export for backwards compatibility (used by some selectors / components).
export { collectDescendants };

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface AppState {
  /* Data */
  tasks: Record<TaskId, Task>;
  projects: Record<ProjectId, Project>;
  /** Ordered top-level task ids per scope. Scope is projectId or "inbox". */
  roots: Record<string, TaskId[]>;

  /* UI / runtime */
  view: ViewKey;
  zoomStack: TaskId[];
  filter: FilterState;
  theme: Theme;
  commandPaletteOpen: boolean;
  shortcutsOpen: boolean;
  /** Currently focused task (focus mode). `null` = off. */
  focusedTaskId: TaskId | null;
  /** Transient marker for the last toggle-to-complete. Used by the Undo toast. */
  lastCompletion: { taskId: TaskId; title: string; at: number } | null;

  /* Timer */
  activeTimer: ActiveTimer | null;

  /* Actions — tasks */
  addTask(args: {
    title: string;
    projectId: ProjectId | null;
    parentId?: TaskId | null;
    afterId?: TaskId | null;
    notes?: string;
    tags?: string[];
    dueDate?: string;
  }): TaskId;
  updateTask(id: TaskId, patch: Partial<Task>): void;
  toggleTask(id: TaskId): void;
  deleteTask(id: TaskId): void;
  duplicateTask(id: TaskId): TaskId | null;
  mergeTaskIntoTarget(sourceId: TaskId, targetId: TaskId): void;
  toggleTodayFlag(id: TaskId): void;
  setCollapsed(id: TaskId, collapsed: boolean): void;
  toggleCollapsed(id: TaskId): void;
  indentTask(id: TaskId): void;
  outdentTask(id: TaskId): void;
  moveTaskUp(id: TaskId): void;
  moveTaskDown(id: TaskId): void;
  /** Move task to a new parent + position (used by drag-and-drop). */
  moveTask(args: {
    id: TaskId;
    newParentId: TaskId | null;
    /** projectId of the new scope; ignored if newParentId is not null. */
    newProjectId?: ProjectId | null;
    newIndex: number;
  }): void;

  /* Actions — projects */
  addProject(name: string, color: string): ProjectId;
  updateProject(id: ProjectId, patch: Partial<Project>): void;
  deleteProject(id: ProjectId): void;

  /* Actions — view */
  setView(view: ViewKey): void;
  zoomInto(id: TaskId): void;
  /** Replace the whole zoom stack with a single task — used by breadcrumbs. */
  zoomTo(id: TaskId): void;
  zoomOut(): void;
  clearZoom(): void;
  setFilter(patch: Partial<FilterState>): void;
  setTheme(theme: Theme): void;
  setCommandPaletteOpen(open: boolean): void;
  setShortcutsOpen(open: boolean): void;
  setFocusedTask(id: TaskId | null): void;
  toggleFocusedTask(id: TaskId): void;
  clearLastCompletion(): void;
  /** Move tasks out of "Today": clear todayDate and push dueDate to tomorrow. */
  deferTasksToTomorrow(ids: TaskId[]): void;

  /* Actions — timer */
  startTimer(taskId: TaskId): void;
  stopTimer(): void;
  toggleTimer(taskId: TaskId): void;
  /** Append a manually-entered session (used when timer wasn't running). */
  addManualSession(taskId: TaskId, durationMs: number): void;
  removeSession(taskId: TaskId, sessionId: string): void;
}

/* -------------------------------------------------------------------------- */
/*  Seed data                                                                  */
/* -------------------------------------------------------------------------- */

function seed(): Pick<AppState, "tasks" | "projects" | "roots" | "view"> {
  const p1: Project = {
    id: asProjectId(nanoid(8)),
    name: "Payment gate",
    color: "indigo",
    archived: false,
    createdAt: Date.now(),
  };
  const p2: Project = {
    id: asProjectId(nanoid(8)),
    name: "Здоровье",
    color: "emerald",
    archived: false,
    createdAt: Date.now(),
  };

  const t1 = newTask({
    title: "PAYOFFLINE-2660: Поправить 500 на /cancel",
    projectId: p1.id,
    tags: ["backend"],
  });
  const t1a = newTask({
    title: "Разделить на два PR",
    projectId: p1.id,
    parentId: t1.id,
  });
  t1a.completed = true;
  t1a.completedAt = Date.now();
  const t1b = newTask({
    title: "Настроить сбор метрик",
    projectId: p1.id,
    parentId: t1.id,
  });
  t1.childrenIds = [t1a.id, t1b.id];

  const t2 = newTask({
    title: "PAYOFFLINE-5416: Доп. поля в ФОС для ЦТО",
    projectId: p1.id,
    tags: ["discovery"],
  });
  const t2a = newTask({
    title: "Обсудить список полей с Марией",
    projectId: p1.id,
    parentId: t2.id,
  });
  t2.childrenIds = [t2a.id];

  const t3 = newTask({
    title: "Консультация с врачом",
    projectId: p2.id,
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  });

  const tInbox = newTask({
    title: "Изучить Workflowy / Things паттерны",
    projectId: null,
    tags: ["research"],
  });

  const tasks: Record<TaskId, Task> = {
    [t1.id]: t1,
    [t1a.id]: t1a,
    [t1b.id]: t1b,
    [t2.id]: t2,
    [t2a.id]: t2a,
    [t3.id]: t3,
    [tInbox.id]: tInbox,
  };

  const projects: Record<ProjectId, Project> = {
    [p1.id]: p1,
    [p2.id]: p2,
  };

  const roots: Record<string, TaskId[]> = {
    [p1.id]: [t1.id, t2.id],
    [p2.id]: [t3.id],
    inbox: [tInbox.id],
  };

  return {
    tasks,
    projects,
    roots,
    view: { kind: "smart", id: "today" },
  };
}

/* -------------------------------------------------------------------------- */
/*  Store                                                                      */
/* -------------------------------------------------------------------------- */

export const useAppStore = create<AppState>()(
  temporal(
    persist(
    (set, get) => ({
      ...seed(),
      zoomStack: [],
      filter: { tag: null, search: "", showCompleted: false },
      theme: "system",
      commandPaletteOpen: false,
      shortcutsOpen: false,
      focusedTaskId: null,
      lastCompletion: null,
      activeTimer: null,

      /* ---- tasks ---- */
      addTask({ title, projectId, parentId, afterId, notes, tags, dueDate }) {
        const task = newTask({ title, projectId, parentId: parentId ?? null, notes, tags, dueDate });
        set((state) => {
          const next = { ...state };
          next.tasks = { ...state.tasks, [task.id]: task };
          if (parentId) {
            const parent = next.tasks[parentId];
            if (!parent) return state;
            const siblings = parent.childrenIds;
            const idx = afterId ? siblings.indexOf(afterId) + 1 : siblings.length;
            next.tasks[parentId] = {
              ...parent,
              childrenIds: insertAt(siblings, idx, task.id),
              collapsed: false,
            };
          } else {
            const key = scopeKey(projectId);
            const list = state.roots[key] ?? [];
            const idx = afterId ? list.indexOf(afterId) + 1 : list.length;
            next.roots = { ...state.roots, [key]: insertAt(list, idx, task.id) };
          }
          return next;
        });
        return task.id;
      },

      updateTask(id, patch) {
        set((state) => {
          const t = state.tasks[id];
          if (!t) return state;
          return {
            tasks: { ...state.tasks, [id]: { ...t, ...patch, updatedAt: Date.now() } },
          };
        });
      },

      toggleTask(id) {
        set((state) => {
          const t = state.tasks[id];
          if (!t) return state;
          const completed = !t.completed;
          const descendants = completed ? collectDescendants(state.tasks, id) : [];
          const nextTasks = { ...state.tasks };
          const now = Date.now();
          nextTasks[id] = {
            ...t,
            completed,
            completedAt: completed ? now : undefined,
            updatedAt: now,
          };
          descendants.forEach((did) => {
            const d = nextTasks[did];
            if (d && !d.completed) {
              nextTasks[did] = {
                ...d,
                completed: true,
                completedAt: now,
                updatedAt: now,
              };
            }
          });
          const lastCompletion = completed
            ? { taskId: id, title: t.title, at: now }
            : state.lastCompletion?.taskId === id
              ? null
              : state.lastCompletion;
          return { tasks: nextTasks, lastCompletion };
        });
      },

      deleteTask(id) {
        set((state) => {
          const t = state.tasks[id];
          if (!t) return state;
          const toRemove = new Set<TaskId>([id, ...collectDescendants(state.tasks, id)]);

          // If the active timer lives inside the deleted subtree, close it first
          // so its elapsed time is still appended to the owning task before the
          // task itself disappears from the tasks map.
          let tasksBase = state.tasks;
          let nextActive = state.activeTimer;
          if (state.activeTimer && toRemove.has(state.activeTimer.taskId)) {
            const finalized = finalizeTimer(state.tasks, state.activeTimer, Date.now());
            tasksBase = finalized.tasks;
            nextActive = finalized.activeTimer;
          }

          const nextTasks: Record<TaskId, Task> = {};
          for (const [k, v] of Object.entries(tasksBase) as [TaskId, Task][]) {
            if (toRemove.has(k)) continue;
            nextTasks[k] = {
              ...v,
              childrenIds: v.childrenIds.filter((c) => !toRemove.has(c)),
            };
          }
          const nextRoots: Record<string, TaskId[]> = {};
          for (const [k, list] of Object.entries(state.roots)) {
            nextRoots[k] = list.filter((x) => !toRemove.has(x));
          }
          const nextZoom = state.zoomStack.filter((x) => !toRemove.has(x));
          const nextFocused =
            state.focusedTaskId && toRemove.has(state.focusedTaskId)
              ? null
              : state.focusedTaskId;
          const nextLastCompletion =
            state.lastCompletion && toRemove.has(state.lastCompletion.taskId)
              ? null
              : state.lastCompletion;
          return {
            tasks: nextTasks,
            roots: nextRoots,
            zoomStack: nextZoom,
            activeTimer: nextActive,
            focusedTaskId: nextFocused,
            lastCompletion: nextLastCompletion,
          };
        });
      },

      duplicateTask(id) {
        const src = get().tasks[id];
        if (!src) return null;
        let newRootId: TaskId | null = null;
        set((state) => {
          const nextTasks: Record<TaskId, Task> = { ...state.tasks };
          const recurse = (tid: TaskId, newParent: TaskId | null): TaskId | null => {
            const t = state.tasks[tid];
            if (!t) return null;
            const nid = asTaskId(nanoid(10));
            const clonedChildren = t.childrenIds
              .map((cid) => recurse(cid, nid))
              .filter((x): x is TaskId => x !== null);
            nextTasks[nid] = {
              ...t,
              id: nid,
              parentId: newParent,
              childrenIds: clonedChildren,
              completed: t.completed,
              completedAt: t.completedAt,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            return nid;
          };
          newRootId = recurse(id, src.parentId);
          if (!newRootId) return state;

          if (src.parentId) {
            const parent = nextTasks[src.parentId];
            if (!parent) return state;
            const idx = parent.childrenIds.indexOf(id);
            nextTasks[src.parentId] = {
              ...parent,
              childrenIds: insertAt(parent.childrenIds, idx + 1, newRootId),
            };
            return { tasks: nextTasks };
          }
          const scope = scopeKey(src.projectId);
          const list = state.roots[scope] ?? [];
          const idx = list.indexOf(id);
          return {
            tasks: nextTasks,
            roots: { ...state.roots, [scope]: insertAt(list, idx + 1, newRootId) },
          };
        });
        return newRootId || null;
      },

      toggleTodayFlag(id) {
        set((state) => {
          const t = state.tasks[id];
          if (!t) return state;
          const iso = todayIso();
          const nextToday = t.todayDate === iso ? undefined : iso;
          return {
            tasks: {
              ...state.tasks,
              [id]: { ...t, todayDate: nextToday, updatedAt: Date.now() },
            },
          };
        });
      },

      mergeTaskIntoTarget(sourceId, targetId) {
        set((state) => {
          const src = state.tasks[sourceId];
          const tgt = state.tasks[targetId];
          if (!src || !tgt || sourceId === targetId) return state;

          // Source is about to disappear; close the timer if it was attached to it.
          let baseTasks = state.tasks;
          let nextActive = state.activeTimer;
          if (state.activeTimer?.taskId === sourceId) {
            const finalized = finalizeTimer(state.tasks, state.activeTimer, Date.now());
            baseTasks = finalized.tasks;
            nextActive = finalized.activeTimer;
          }

          const nextTasks: Record<TaskId, Task> = { ...baseTasks };

          src.childrenIds.forEach((cid) => {
            const c = nextTasks[cid];
            if (!c) return;
            nextTasks[cid] = { ...c, parentId: tgt.id, projectId: tgt.projectId };
          });

          nextTasks[tgt.id] = {
            ...tgt,
            title: tgt.title + src.title,
            childrenIds: [...tgt.childrenIds, ...src.childrenIds],
            updatedAt: Date.now(),
          };

          let nextRoots = state.roots;
          if (src.parentId) {
            const parent = nextTasks[src.parentId];
            if (parent) {
              nextTasks[src.parentId] = {
                ...parent,
                childrenIds: parent.childrenIds.filter((x) => x !== sourceId),
              };
            }
          } else {
            const scope = scopeKey(src.projectId);
            nextRoots = {
              ...state.roots,
              [scope]: (state.roots[scope] ?? []).filter((x) => x !== sourceId),
            };
          }

          delete nextTasks[sourceId];
          const nextZoom = state.zoomStack.filter((x) => x !== sourceId);
          return {
            tasks: nextTasks,
            roots: nextRoots,
            zoomStack: nextZoom,
            activeTimer: nextActive,
          };
        });
      },

      setCollapsed(id, collapsed) {
        set((state) => {
          const t = state.tasks[id];
          if (!t) return state;
          return { tasks: { ...state.tasks, [id]: { ...t, collapsed } } };
        });
      },

      toggleCollapsed(id) {
        const t = get().tasks[id];
        if (!t) return;
        get().setCollapsed(id, !t.collapsed);
      },

      indentTask(id) {
        set((state) => {
          const task = state.tasks[id];
          if (!task) return state;
          const container = readContainer(state.tasks, state.roots, id);
          const idx = container.indexOf(id);
          if (idx <= 0) return state; // need a previous sibling
          const prevId = container[idx - 1];
          const prev = state.tasks[prevId];
          if (!prev) return state;

          // Remove from current container
          const nextContainer = removeFromArray(container, id);

          // Add to previous sibling's children (append)
          const nextPrev = {
            ...prev,
            childrenIds: [...prev.childrenIds, id],
            collapsed: false,
          };
          const nextTask = { ...task, parentId: prev.id, updatedAt: Date.now() };

          const nextState: AppState = {
            ...state,
            tasks: { ...state.tasks, [prev.id]: nextPrev, [id]: nextTask },
          };

          const c = getContainer(state.tasks, id);
          if (c?.kind === "parent") {
            nextState.tasks[c.parentId] = {
              ...nextState.tasks[c.parentId],
              childrenIds: nextContainer,
            };
          } else if (c?.kind === "root") {
            nextState.roots = { ...state.roots, [c.scope]: nextContainer };
          }
          return nextState;
        });
      },

      outdentTask(id) {
        set((state) => {
          const task = state.tasks[id];
          if (!task || !task.parentId) return state;
          const parent = state.tasks[task.parentId];
          if (!parent) return state;

          // Remove from parent
          const parentChildren = removeFromArray(parent.childrenIds, id);
          const nextParent = { ...parent, childrenIds: parentChildren };

          // Insert into grandparent right after parent
          const grandparentId = parent.parentId;
          const nextTask = { ...task, parentId: grandparentId, updatedAt: Date.now() };
          const nextState: AppState = {
            ...state,
            tasks: {
              ...state.tasks,
              [parent.id]: nextParent,
              [id]: nextTask,
            },
          };

          if (grandparentId) {
            const gp = nextState.tasks[grandparentId];
            if (!gp) return state;
            const gpChildren = gp.childrenIds;
            const pIdx = gpChildren.indexOf(parent.id);
            nextState.tasks[grandparentId] = {
              ...gp,
              childrenIds: insertAt(gpChildren, pIdx + 1, id),
            };
          } else {
            const scope = scopeKey(task.projectId);
            const list = state.roots[scope] ?? [];
            const pIdx = list.indexOf(parent.id);
            nextState.roots = {
              ...state.roots,
              [scope]: insertAt(list, pIdx + 1, id),
            };
          }
          return nextState;
        });
      },

      moveTaskUp(id) {
        set((state) => {
          const c = getContainer(state.tasks, id);
          if (!c) return state;
          const arr = readContainer(state.tasks, state.roots, id);
          const i = arr.indexOf(id);
          if (i <= 0) return state;
          const next = arr.slice();
          [next[i - 1], next[i]] = [next[i], next[i - 1]];
          const clone: AppState = { ...state };
          if (c.kind === "parent") {
            clone.tasks = {
              ...state.tasks,
              [c.parentId]: { ...state.tasks[c.parentId], childrenIds: next },
            };
          } else {
            clone.roots = { ...state.roots, [c.scope]: next };
          }
          return clone;
        });
      },

      moveTaskDown(id) {
        set((state) => {
          const c = getContainer(state.tasks, id);
          if (!c) return state;
          const arr = readContainer(state.tasks, state.roots, id);
          const i = arr.indexOf(id);
          if (i < 0 || i >= arr.length - 1) return state;
          const next = arr.slice();
          [next[i], next[i + 1]] = [next[i + 1], next[i]];
          const clone: AppState = { ...state };
          if (c.kind === "parent") {
            clone.tasks = {
              ...state.tasks,
              [c.parentId]: { ...state.tasks[c.parentId], childrenIds: next },
            };
          } else {
            clone.roots = { ...state.roots, [c.scope]: next };
          }
          return clone;
        });
      },

      moveTask({ id, newParentId, newProjectId, newIndex }) {
        set((state) => {
          const task = state.tasks[id];
          if (!task) return state;

          // Prevent dropping into own descendants
          const desc = new Set(collectDescendants(state.tasks, id));
          if (newParentId && (desc.has(newParentId) || newParentId === id)) return state;

          // Remove from current location
          const oldContainer = readContainer(state.tasks, state.roots, id);
          const filteredOld = removeFromArray(oldContainer, id);

          const nextTasks = { ...state.tasks };
          const nextRoots: Record<string, TaskId[]> = { ...state.roots };

          const oldC = getContainer(state.tasks, id);
          if (oldC?.kind === "parent") {
            nextTasks[oldC.parentId] = {
              ...nextTasks[oldC.parentId],
              childrenIds: filteredOld,
            };
          } else if (oldC?.kind === "root") {
            nextRoots[oldC.scope] = filteredOld;
          }

          // New projectId propagates from target
          const targetProjectId = newParentId
            ? (nextTasks[newParentId]?.projectId ?? null)
            : (newProjectId ?? null);

          // Update task + all descendants' projectId if needed
          const updatedTask: Task = {
            ...task,
            parentId: newParentId,
            projectId: targetProjectId,
            updatedAt: Date.now(),
          };
          nextTasks[id] = updatedTask;
          if (targetProjectId !== task.projectId) {
            const children = collectDescendants(state.tasks, id);
            children.forEach((cid) => {
              nextTasks[cid] = { ...nextTasks[cid], projectId: targetProjectId };
            });
          }

          // Insert into new container
          if (newParentId) {
            const parent = nextTasks[newParentId];
            if (!parent) return state;
            nextTasks[newParentId] = {
              ...parent,
              childrenIds: insertAt(parent.childrenIds, newIndex, id),
              collapsed: false,
            };
          } else {
            const scope = scopeKey(targetProjectId);
            const list = nextRoots[scope] ?? [];
            nextRoots[scope] = insertAt(list, newIndex, id);
          }

          return { tasks: nextTasks, roots: nextRoots };
        });
      },

      /* ---- projects ---- */
      addProject(name, color) {
        const p: Project = {
          id: asProjectId(nanoid(8)),
          name,
          color,
          archived: false,
          createdAt: Date.now(),
        };
        set((state) => ({
          projects: { ...state.projects, [p.id]: p },
          roots: { ...state.roots, [p.id]: [] },
          view: { kind: "project", id: p.id },
        }));
        return p.id;
      },
      updateProject(id, patch) {
        set((state) => {
          const p = state.projects[id];
          if (!p) return state;
          return { projects: { ...state.projects, [id]: { ...p, ...patch } } };
        });
      },
      deleteProject(id) {
        set((state) => {
          const rootsCopy = { ...state.roots };
          const orphans = rootsCopy[id] ?? [];
          delete rootsCopy[id];
          // Move orphan top-level tasks to inbox; descendants inherit via projectId.
          const nextTasks = { ...state.tasks };
          const updateProjectRecursive = (tid: TaskId) => {
            const t = nextTasks[tid];
            if (!t) return;
            nextTasks[tid] = { ...t, projectId: null };
            t.childrenIds.forEach(updateProjectRecursive);
          };
          orphans.forEach(updateProjectRecursive);
          rootsCopy.inbox = [...(rootsCopy.inbox ?? []), ...orphans];

          const nextProjects = { ...state.projects };
          delete nextProjects[id];

          const nextView: ViewKey =
            state.view.kind === "project" && state.view.id === id
              ? { kind: "smart", id: "inbox" }
              : state.view;

          return { projects: nextProjects, tasks: nextTasks, roots: rootsCopy, view: nextView };
        });
      },

      /* ---- view ---- */
      setView(view) {
        set({ view, zoomStack: [] });
      },
      zoomInto(id) {
        set((state) => {
          const task = state.tasks[id];
          if (!task) return state;
          // Switch view to the task's project so the sidebar stays in sync
          const nextView: ViewKey = task.projectId
            ? { kind: "project", id: task.projectId }
            : { kind: "smart", id: "inbox" };
          const stack = [...state.zoomStack, id];
          return { view: nextView, zoomStack: stack };
        });
      },
      zoomTo(id) {
        set((state) => {
          const task = state.tasks[id];
          if (!task) return state;
          const nextView: ViewKey = task.projectId
            ? { kind: "project", id: task.projectId }
            : { kind: "smart", id: "inbox" };
          return { view: nextView, zoomStack: [id] };
        });
      },
      zoomOut() {
        set((state) => ({ zoomStack: state.zoomStack.slice(0, -1) }));
      },
      clearZoom() {
        set({ zoomStack: [] });
      },
      setFilter(patch) {
        set((state) => ({ filter: { ...state.filter, ...patch } }));
      },
      setTheme(theme) {
        set({ theme });
      },
      setCommandPaletteOpen(open) {
        set({ commandPaletteOpen: open });
      },
      setShortcutsOpen(open) {
        set({ shortcutsOpen: open });
      },
      setFocusedTask(id) {
        set((state) => {
          if (id && !state.tasks[id]) return state;
          return { focusedTaskId: id };
        });
      },
      toggleFocusedTask(id) {
        set((state) => ({
          focusedTaskId: state.focusedTaskId === id ? null : id,
        }));
      },
      clearLastCompletion() {
        set({ lastCompletion: null });
      },
      deferTasksToTomorrow(ids) {
        if (ids.length === 0) return;
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const offset = tomorrow.getTimezoneOffset();
        const iso = new Date(tomorrow.getTime() - offset * 60_000)
          .toISOString()
          .slice(0, 10);
        set((state) => {
          const nextTasks = { ...state.tasks };
          const now = Date.now();
          ids.forEach((id) => {
            const t = nextTasks[id];
            if (!t) return;
            nextTasks[id] = {
              ...t,
              todayDate: undefined,
              dueDate: iso,
              updatedAt: now,
            };
          });
          return { tasks: nextTasks };
        });
      },

      /* ---- timer ---- */
      startTimer(taskId) {
        set((state) => {
          if (!state.tasks[taskId]) return state;
          const now = Date.now();
          const finalized = finalizeTimer(state.tasks, state.activeTimer, now);
          return {
            tasks: finalized.tasks,
            activeTimer: { taskId, startedAt: now },
            focusedTaskId: taskId,
          };
        });
      },
      stopTimer() {
        set((state) => {
          if (!state.activeTimer) return state;
          const finalized = finalizeTimer(state.tasks, state.activeTimer, Date.now());
          return {
            tasks: finalized.tasks,
            activeTimer: finalized.activeTimer,
          };
        });
      },
      toggleTimer(taskId) {
        const { activeTimer, startTimer, stopTimer } = get();
        if (activeTimer?.taskId === taskId) stopTimer();
        else startTimer(taskId);
      },
      addManualSession(taskId, durationMs) {
        if (!Number.isFinite(durationMs) || durationMs <= 0) return;
        set((state) => {
          const t = state.tasks[taskId];
          if (!t) return state;
          const now = Date.now();
          const session: TimerSession = {
            id: nanoid(8),
            startedAt: now - durationMs,
            endedAt: now,
            durationMs,
          };
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...t,
                sessions: [...t.sessions, session],
                updatedAt: now,
              },
            },
          };
        });
      },
      removeSession(taskId, sessionId) {
        set((state) => {
          const t = state.tasks[taskId];
          if (!t) return state;
          const next = t.sessions.filter((s) => s.id !== sessionId);
          if (next.length === t.sessions.length) return state;
          return {
            tasks: {
              ...state.tasks,
              [taskId]: { ...t, sessions: next, updatedAt: Date.now() },
            },
          };
        });
      },
    }),
    {
      name: "taskflow.v1",
      version: STORE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      migrate: (persisted: unknown, version: number) =>
        migrate(persisted, version) as Partial<AppState>,
      partialize: (state) => ({
        tasks: state.tasks,
        projects: state.projects,
        roots: state.roots,
        view: state.view,
        filter: state.filter,
        theme: state.theme,
        activeTimer: state.activeTimer,
        focusedTaskId: state.focusedTaskId,
      }),
    },
  ),
    {
      limit: 100,
      partialize: (state) => {
        const { tasks, projects, roots } = state;
        return { tasks, projects, roots } as Partial<AppState>;
      },
      equality: (a, b) =>
        a.tasks === b.tasks && a.projects === b.projects && a.roots === b.roots,
    },
  ),
);

/* -------------------------------------------------------------------------- */
/*  Selectors                                                                  */
/* -------------------------------------------------------------------------- */

export function selectZoomedTaskId(state: AppState): TaskId | null {
  return state.zoomStack.length ? state.zoomStack[state.zoomStack.length - 1] : null;
}

export function selectTaskPath(state: AppState, id: TaskId): Task[] {
  const out: Task[] = [];
  let cur: Task | undefined = state.tasks[id];
  while (cur) {
    out.push(cur);
    cur = cur.parentId ? state.tasks[cur.parentId] : undefined;
  }
  return out.reverse();
}

export function selectVisibleRootIds(state: AppState): TaskId[] {
  const zoomed = selectZoomedTaskId(state);
  if (zoomed) return state.tasks[zoomed]?.childrenIds ?? [];
  const { view } = state;
  if (view.kind === "project") return state.roots[view.id] ?? [];
  // Smart lists
  if (view.id === "inbox") return state.roots.inbox ?? [];
  if (view.id === "today" || view.id === "upcoming" || view.id === "anytime" || view.id === "logbook") {
    // Flatten all tasks (top level across projects) — the main view filters further
    return Object.values(state.roots).flat();
  }
  return [];
}

export function selectTasksForView(state: AppState): Task[] {
  const view = state.view;
  const showCompleted = state.filter.showCompleted;
  const all = Object.values(state.tasks);

  const matchesFilter = (t: Task) => {
    if (state.filter.tag && !t.tags.includes(state.filter.tag)) return false;
    if (state.filter.search) {
      const s = state.filter.search.toLowerCase();
      if (!t.title.toLowerCase().includes(s) && !(t.notes ?? "").toLowerCase().includes(s))
        return false;
    }
    return true;
  };

  if (view.kind === "smart") {
    if (view.id === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return all.filter(
        (t) =>
          !t.completed &&
          matchesFilter(t) &&
          t.dueDate &&
          new Date(t.dueDate).getTime() <= today.getTime() + 86400000,
      );
    }
    if (view.id === "upcoming") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return all.filter(
        (t) =>
          !t.completed &&
          matchesFilter(t) &&
          t.dueDate &&
          new Date(t.dueDate).getTime() > today.getTime(),
      );
    }
    if (view.id === "anytime") {
      return all.filter((t) => !t.completed && !t.dueDate && matchesFilter(t));
    }
    if (view.id === "logbook") {
      return all.filter((t) => t.completed && matchesFilter(t));
    }
    if (view.id === "inbox") {
      return all.filter(
        (t) => t.projectId === null && (showCompleted || !t.completed) && matchesFilter(t),
      );
    }
  }
  return all.filter(
    (t) =>
      view.kind === "project" &&
      t.projectId === view.id &&
      (showCompleted || !t.completed) &&
      matchesFilter(t),
  );
}

export function selectAllTags(state: AppState): string[] {
  const s = new Set<string>();
  Object.values(state.tasks).forEach((t) => t.tags.forEach((tg) => s.add(tg)));
  return Array.from(s).sort();
}
