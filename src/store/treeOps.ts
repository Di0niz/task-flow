import { nanoid } from "nanoid";
import { asTaskId } from "../types";
import type {
  ActiveTimer,
  ProjectId,
  Task,
  TaskId,
  TimerSession,
} from "../types";

/* -------------------------------------------------------------------------- */
/*  Generic immutable helpers                                                  */
/* -------------------------------------------------------------------------- */

export function removeFromArray<T>(arr: T[], value: T): T[] {
  const i = arr.indexOf(value);
  if (i === -1) return arr;
  const next = arr.slice();
  next.splice(i, 1);
  return next;
}

export function insertAt<T>(arr: T[], index: number, value: T): T[] {
  const next = arr.slice();
  const i = Math.max(0, Math.min(index, next.length));
  next.splice(i, 0, value);
  return next;
}

/* -------------------------------------------------------------------------- */
/*  Scope keys                                                                 */
/* -------------------------------------------------------------------------- */

export const INBOX_SCOPE = "inbox" as const;
export type ScopeKey = ProjectId | typeof INBOX_SCOPE;

export const scopeKey = (projectId: ProjectId | null): ScopeKey =>
  projectId ?? INBOX_SCOPE;

/* -------------------------------------------------------------------------- */
/*  Container introspection                                                    */
/* -------------------------------------------------------------------------- */

export type Container =
  | { kind: "parent"; parentId: TaskId }
  | { kind: "root"; scope: ScopeKey };

export function getContainer(
  tasks: Record<TaskId, Task>,
  id: TaskId,
): Container | null {
  const task = tasks[id];
  if (!task) return null;
  if (task.parentId) return { kind: "parent", parentId: task.parentId };
  return { kind: "root", scope: scopeKey(task.projectId) };
}

export function readContainer(
  tasks: Record<TaskId, Task>,
  roots: Record<string, TaskId[]>,
  id: TaskId,
): TaskId[] {
  const c = getContainer(tasks, id);
  if (!c) return [];
  if (c.kind === "parent") return tasks[c.parentId]?.childrenIds ?? [];
  return roots[c.scope] ?? [];
}

/* -------------------------------------------------------------------------- */
/*  Task factory                                                               */
/* -------------------------------------------------------------------------- */

export function newTask(
  partial: Partial<Task> & Pick<Task, "title" | "projectId">,
): Task {
  const now = Date.now();
  return {
    id: asTaskId(nanoid(10)),
    title: partial.title,
    notes: partial.notes,
    completed: false,
    projectId: partial.projectId,
    parentId: partial.parentId ?? null,
    childrenIds: [],
    tags: partial.tags ?? [],
    collapsed: false,
    sessions: [],
    dueDate: partial.dueDate,
    createdAt: now,
    updatedAt: now,
  };
}

/* -------------------------------------------------------------------------- */
/*  Tree traversal                                                             */
/* -------------------------------------------------------------------------- */

/** Collect descendant ids of `rootId` (excluding the root itself). */
export function collectDescendants(
  tasks: Record<TaskId, Task>,
  rootId: TaskId,
): TaskId[] {
  const out: TaskId[] = [];
  const stack = [...(tasks[rootId]?.childrenIds ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    const t = tasks[id];
    if (t) stack.push(...t.childrenIds);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Timer finalization                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Close the active timer and append its TimerSession to the owning task.
 * No-op (with the same shape) if there is no active timer or zero elapsed.
 */
export function finalizeTimer(
  tasks: Record<TaskId, Task>,
  activeTimer: ActiveTimer | null,
  endedAt: number,
): { tasks: Record<TaskId, Task>; activeTimer: ActiveTimer | null } {
  if (!activeTimer) return { tasks, activeTimer: null };
  const t = tasks[activeTimer.taskId];
  if (!t) return { tasks, activeTimer: null };
  const durationMs = Math.max(0, endedAt - activeTimer.startedAt);
  if (durationMs === 0) return { tasks, activeTimer: null };
  const session: TimerSession = {
    id: nanoid(8),
    startedAt: activeTimer.startedAt,
    endedAt,
    durationMs,
  };
  return {
    tasks: {
      ...tasks,
      [t.id]: { ...t, sessions: [...t.sessions, session] },
    },
    activeTimer: null,
  };
}
