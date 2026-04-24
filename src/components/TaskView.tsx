import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Eye, EyeOff, Search, Undo2, X } from "lucide-react";
import { useAppStore, selectZoomedTaskId } from "../store/useAppStore";
import { TaskTree } from "./TaskTree";
import { NewTaskInput } from "./NewTaskInput";
import { Breadcrumbs } from "./Breadcrumbs";
import { Stats } from "./Stats";
import { TagChip } from "./TagChip";
import { cn, startOfTodayMs, todayIso } from "../lib/utils";
import { PROJECT_COLORS, type TaskId } from "../types";

export function TaskView() {
  const view = useAppStore((s) => s.view);
  const projects = useAppStore((s) => s.projects);
  const tasks = useAppStore((s) => s.tasks);
  const roots = useAppStore((s) => s.roots);
  const zoomedId = useAppStore(selectZoomedTaskId);
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const focusedTaskId = useAppStore((s) => s.focusedTaskId);
  const setFocusedTask = useAppStore((s) => s.setFocusedTask);
  const deferTasksToTomorrow = useAppStore((s) => s.deferTasksToTomorrow);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    Object.values(tasks).forEach((t) => t.tags.forEach((tg) => s.add(tg)));
    return Array.from(s).sort();
  }, [tasks]);

  const { completedTodayInView, completedTodayGlobal, completedTodayIdsInView } = useMemo(() => {
    const startMs = startOfTodayMs();
    const todayEndMs = startMs + 86400000;
    const iso = todayIso();
    const isInViewScope = (t: { projectId: string | null; todayDate?: string; dueDate?: string }) => {
      if (view.kind === "project") return t.projectId === view.id;
      if (view.id === "inbox") return t.projectId === null;
      if (view.id === "today") {
        return (
          t.todayDate === iso ||
          (!!t.dueDate && new Date(t.dueDate).getTime() <= todayEndMs)
        );
      }
      return true;
    };
    let global = 0;
    const inViewList: { id: TaskId; completedAt: number }[] = [];
    Object.values(tasks).forEach((t) => {
      if (!t.completed) return;
      const completedAt = t.completedAt ?? 0;
      if (completedAt < startMs) return;
      global += 1;
      if (isInViewScope(t)) inViewList.push({ id: t.id, completedAt });
    });
    inViewList.sort((a, b) => b.completedAt - a.completedAt);
    return {
      completedTodayInView: inViewList.length,
      completedTodayGlobal: global,
      completedTodayIdsInView: inViewList.map((x) => x.id),
    };
  }, [tasks, view]);

  const todayProgress = useMemo(() => {
    const iso = todayIso();
    const startMs = startOfTodayMs();
    const todayEndMs = startMs + 86400000;
    let total = 0;
    let done = 0;
    Object.values(tasks).forEach((t) => {
      const inToday =
        t.todayDate === iso ||
        (t.dueDate && new Date(t.dueDate).getTime() <= todayEndMs) ||
        (t.completed && (t.completedAt ?? 0) >= startMs);
      if (!inToday) return;
      total += 1;
      if (t.completed) done += 1;
    });
    return { total, done };
  }, [tasks]);

  // Compute the list of task ids to render as roots
  const rootIds: TaskId[] = useMemo(() => {
    if (zoomedId) return tasks[zoomedId]?.childrenIds ?? [];
    if (view.kind === "project") {
      const list = roots[view.id] ?? [];
      return filter.showCompleted
        ? list
        : list.filter((id) => tasks[id] && !tasks[id].completed);
    }
    if (view.id === "inbox") {
      const list = roots.inbox ?? [];
      return filter.showCompleted
        ? list
        : list.filter((id) => tasks[id] && !tasks[id].completed);
    }
    // today, upcoming, anytime, logbook — flat filtered
    const all = Object.values(tasks);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (view.id === "today") {
      const iso = todayIso();
      return all
        .filter(
          (t) =>
            !t.completed &&
            (t.todayDate === iso ||
              (t.dueDate &&
                new Date(t.dueDate).getTime() <= today.getTime() + 86400000)),
        )
        .map((t) => t.id);
    }
    if (view.id === "upcoming") {
      return all
        .filter(
          (t) =>
            !t.completed &&
            t.dueDate &&
            new Date(t.dueDate).getTime() > today.getTime(),
        )
        .map((t) => t.id);
    }
    if (view.id === "anytime") {
      return all
        .filter((t) => !t.completed && !t.dueDate && t.parentId === null)
        .map((t) => t.id);
    }
    if (view.id === "logbook") {
      return all
        .filter((t) => t.completed)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
        .map((t) => t.id);
    }
    return [];
  }, [view, roots, tasks, zoomedId, filter.showCompleted]);

  // Apply tag + search filter
  const filteredIds: TaskId[] = useMemo(() => {
    return rootIds.filter((id) => {
      const t = tasks[id];
      if (!t) return false;
      if (filter.tag && !t.tags.includes(filter.tag)) return false;
      if (filter.search) {
        const s = filter.search.toLowerCase();
        if (
          !t.title.toLowerCase().includes(s) &&
          !(t.notes ?? "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [rootIds, filter, tasks]);

  // Focus mode — when active, drill down to focused task's top-level ancestor
  // so the task stays visible in the current list, then narrow to that one row.
  const focusedVisibleIds: TaskId[] | null = useMemo(() => {
    if (!focusedTaskId) return null;
    if (!tasks[focusedTaskId]) return null;
    // Walk up to find the ancestor present in filteredIds; fallback to the task itself.
    let cur: TaskId | null = focusedTaskId;
    while (cur) {
      if (filteredIds.includes(cur)) return [cur];
      const next: TaskId | null = tasks[cur]?.parentId ?? null;
      cur = next;
    }
    return [focusedTaskId];
  }, [focusedTaskId, filteredIds, tasks]);

  const visibleIds = focusedVisibleIds ?? filteredIds;

  // Header title + context
  let title = "Сегодня";
  let subtitle: string | undefined = "Что нужно сделать именно сегодня";
  let allowInsert = true;
  let projectIdForInsert: string | null = null;
  let parentIdForInsert: TaskId | null = null;

  if (zoomedId) {
    const zt = tasks[zoomedId];
    title = zt?.title || "Без названия";
    subtitle = "Подзадачи";
    parentIdForInsert = zoomedId;
    projectIdForInsert = zt?.projectId ?? null;
  } else if (view.kind === "project") {
    const p = projects[view.id];
    title = p?.name ?? "Проект";
    subtitle = undefined;
    projectIdForInsert = view.id;
  } else {
    switch (view.id) {
      case "today":
        title = "Сегодня";
        subtitle = "Что нужно сделать именно сегодня";
        projectIdForInsert = null;
        break;
      case "inbox":
        title = "Входящие";
        subtitle = "Без проекта — просто накиданные мысли";
        projectIdForInsert = null;
        break;
      case "upcoming":
        title = "Предстоящее";
        subtitle = "Задачи с будущими датами";
        allowInsert = false;
        break;
      case "anytime":
        title = "Когда-нибудь";
        subtitle = "Без даты, но висит на радаре";
        allowInsert = false;
        break;
      case "logbook":
        title = "Журнал";
        subtitle = "Уже закрытые задачи";
        allowInsert = false;
        break;
    }
  }

  // Stats view
  if (view.kind === "smart" && view.id === "stats") {
    return (
      <main className="flex h-full flex-1 flex-col overflow-hidden">
        <header className="px-8 pt-6 pb-4">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-2xl font-semibold tracking-tight">Статистика</h1>
            <p className="mt-0.5 text-xs text-fg-subtle">
              Что получилось сделать и сколько времени ушло
            </p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <div className="mx-auto max-w-5xl">
            <Stats />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-full flex-1 flex-col overflow-hidden">
      <header className="px-8 pt-6 pb-3">
        <div className="mx-auto max-w-5xl">
          <Breadcrumbs />
          <div className="mt-1 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">
                {title}
              </h1>
              {view.kind === "smart" && view.id === "today" && !zoomedId && todayProgress.total > 0 && (
                <DayProgress done={todayProgress.done} total={todayProgress.total} />
              )}
              {focusedTaskId && tasks[focusedTaskId] && (
                <FocusPill
                  title={tasks[focusedTaskId].title || "Без названия"}
                  onExit={() => setFocusedTask(null)}
                />
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-fg-subtle">{subtitle}</p>
            )}
          </div>

          <HeaderToolbar
            search={filter.search}
            showCompleted={filter.showCompleted}
            completedTodayInView={completedTodayInView}
            completedTodayGlobal={completedTodayGlobal}
            onSearchChange={(v) => setFilter({ search: v })}
            onToggleCompleted={() => setFilter({ showCompleted: !filter.showCompleted })}
          />
        </div>

        {allTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            <button
              className={cn(
                "chip transition-colors",
                filter.tag === null
                  ? "bg-bg-muted text-fg-muted"
                  : "text-fg-subtle hover:text-fg-muted",
              )}
              onClick={() => setFilter({ tag: null })}
            >
              все
            </button>
            {allTags.map((t) => (
              <TagChip
                key={t}
                tag={t}
                active={filter.tag === t}
                onClick={() => setFilter({ tag: filter.tag === t ? null : t })}
              />
            ))}
          </div>
        )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-10">
        <div className="mx-auto max-w-5xl">
          {view.kind === "smart" &&
            view.id === "today" &&
            !zoomedId &&
            !focusedTaskId &&
            (() => {
              const pendingIds = visibleIds.filter((id) => {
                const t = tasks[id];
                return t && !t.completed;
              });
              const OVERLOAD_THRESHOLD = 5;
              if (pendingIds.length <= OVERLOAD_THRESHOLD) return null;
              const deferCount = pendingIds.length - OVERLOAD_THRESHOLD;
              const targetIds = pendingIds.slice(-deferCount);
              return (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[12px] text-fg-muted animate-fade-in">
                  <div className="min-w-0">
                    <div className="font-medium text-fg">
                      На сегодня запланировано {pendingIds.length} задач
                    </div>
                    <div className="mt-0.5 text-[11px] text-fg-subtle">
                      Многовато — часть можно перенести на завтра.
                    </div>
                  </div>
                  <button
                    className="shrink-0 rounded-md border border-border bg-bg px-2 py-1 text-[11px] hover:bg-bg-muted"
                    onClick={() => deferTasksToTomorrow(targetIds)}
                  >
                    Перенести {deferCount} на завтра
                  </button>
                </div>
              );
            })()}

          {visibleIds.length === 0 && (
            <EmptyState zoomed={!!zoomedId} viewName={title} />
          )}
          {view.kind === "smart" && view.id === "today" && !zoomedId && !focusedTaskId ? (
            <TodayGroups ids={visibleIds} />
          ) : (
            <TaskTree rootIds={visibleIds} />
          )}
          {allowInsert && !focusedTaskId && (
            <div className="mt-4">
              <NewTaskInput
                projectId={projectIdForInsert}
                parentId={parentIdForInsert}
                markToday={view.kind === "smart" && view.id === "today" && !zoomedId}
              />
            </div>
          )}

          {!filter.showCompleted &&
            !focusedTaskId &&
            !(view.kind === "smart" && view.id === "logbook") &&
            completedTodayIdsInView.length > 0 && (
              <CompletedTodayFold ids={completedTodayIdsInView} />
            )}
        </div>
      </div>
    </main>
  );
}

function TodayGroups({ ids }: { ids: TaskId[] }) {
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);

  const groups = useMemo(() => {
    const map = new Map<string | null, TaskId[]>();
    ids.forEach((id) => {
      const t = tasks[id];
      if (!t) return;
      const key = t.projectId ?? null;
      const arr = map.get(key);
      if (arr) arr.push(id);
      else map.set(key, [id]);
    });
    const entries = Array.from(map.entries());
    entries.sort(([a], [b]) => {
      if (a === null) return -1;
      if (b === null) return 1;
      return (projects[a]?.name ?? "").localeCompare(projects[b]?.name ?? "");
    });
    return entries;
  }, [ids, tasks, projects]);

  return (
    <div className="flex flex-col gap-5">
      {groups.map(([projectId, groupIds]) => {
        const project = projectId ? projects[projectId] : null;
        const hex = project
          ? PROJECT_COLORS.find((c) => c.name === project.color)?.hex ?? "#888"
          : null;
        const name = project?.name ?? "Входящие";
        return (
          <section key={projectId ?? "inbox"}>
            <header className="mb-1 flex items-center gap-2 border-b border-border pb-1.5">
              {hex ? (
                <span
                  className="inline-block h-[13px] w-[13px] shrink-0 rounded-full border-[2px]"
                  style={{ borderColor: hex }}
                />
              ) : (
                <span className="inline-block h-[13px] w-[13px] shrink-0 rounded-full border-[2px] border-fg-subtle" />
              )}
              <span className="text-[14px] font-semibold">{name}</span>
            </header>
            <TaskTree rootIds={groupIds} />
          </section>
        );
      })}
    </div>
  );
}

function CompletedTodayFold({ ids }: { ids: TaskId[] }) {
  const [open, setOpen] = useState(false);
  const tasks = useAppStore((s) => s.tasks);
  const toggleTask = useAppStore((s) => s.toggleTask);
  if (ids.length === 0) return null;
  return (
    <section className="mt-6 border-t border-border pt-3">
      <button
        className="group/fold inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-fg-subtle transition-colors hover:text-fg-muted"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Check size={11} className="text-success" />
        <span>Выполнено сегодня · {ids.length}</span>
      </button>
      {open && (
        <ul className="mt-2 flex flex-col animate-fade-in">
          {ids.map((id) => {
            const t = tasks[id];
            if (!t) return null;
            return (
              <li
                key={id}
                className="group/done flex items-center gap-2.5 rounded-[4px] py-[4px] pl-2 pr-2 text-[13px] transition-colors hover:bg-bg-muted/70"
              >
                <button
                  className="h-[7px] w-[7px] shrink-0 rounded-full bg-fg-subtle hover:bg-fg/70 transition-colors"
                  onClick={() => toggleTask(id)}
                  title="Вернуть в активные"
                  aria-label="Вернуть в активные"
                />
                <span className="min-w-0 flex-1 truncate text-fg-subtle line-through decoration-fg-subtle/60">
                  {t.title || "Без названия"}
                </span>
                <button
                  className="opacity-0 group-hover/done:opacity-100 transition-opacity text-fg-subtle hover:text-fg-muted"
                  onClick={() => toggleTask(id)}
                  title="Отменить выполнение"
                  aria-label="Отменить выполнение"
                >
                  <Undo2 size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function HeaderToolbar({
  search,
  showCompleted,
  completedTodayInView,
  completedTodayGlobal,
  onSearchChange,
  onToggleCompleted,
}: {
  search: string;
  showCompleted: boolean;
  completedTodayInView: number;
  completedTodayGlobal: number;
  onSearchChange(value: string): void;
  onToggleCompleted(): void;
}) {
  const [searchOpen, setSearchOpen] = useState(!!search);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (search && !searchOpen) setSearchOpen(true);
  }, [search, searchOpen]);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const handleBlur = () => {
    if (!search) setSearchOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onSearchChange("");
      setSearchOpen(false);
    }
  };

  const itemClass =
    "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-fg-subtle hover:bg-bg-muted/70 hover:text-fg-muted transition-colors";

  return (
    <div className="flex items-center gap-0.5">
      {searchOpen ? (
        <div className="relative">
          <Search
            size={12}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKey}
            placeholder="Поиск в списке…"
            className="h-7 w-48 rounded-md bg-bg-muted/70 pl-7 pr-7 text-xs outline-none placeholder:text-fg-subtle focus:bg-bg-muted"
          />
          {search && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSearchChange("")}
              className="absolute right-1.5 top-1/2 grid -translate-y-1/2 h-4 w-4 place-items-center rounded hover:bg-bg hover:text-fg-muted text-fg-subtle"
              title="Очистить"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ) : (
        <button
          className={itemClass}
          onClick={() => setSearchOpen(true)}
          title="Поиск в списке"
        >
          <Search size={12} />
        </button>
      )}

      <button
        className={cn(
          itemClass,
          showCompleted && "text-fg-muted bg-bg-muted/50",
        )}
        onClick={onToggleCompleted}
        title={
          completedTodayGlobal > completedTodayInView
            ? `Сегодня здесь: ${completedTodayInView} · всего сегодня: ${completedTodayGlobal}`
            : `Выполнено сегодня: ${completedTodayInView}`
        }
      >
        {showCompleted ? <Eye size={12} /> : <EyeOff size={12} />}
        <span>Выполненные</span>
        {completedTodayInView > 0 && (
          <span
            className={cn(
              "-mr-0.5 rounded px-1 text-[10px] tabular-nums",
              showCompleted
                ? "bg-bg text-fg-muted"
                : "bg-bg-muted text-fg-subtle",
            )}
          >
            {completedTodayInView}
          </span>
        )}
      </button>
    </div>
  );
}

function FocusPill({ title, onExit }: { title: string; onExit(): void }) {
  return (
    <span
      className="inline-flex max-w-[240px] shrink-0 items-center gap-1 rounded-full border border-accent/30 bg-accent/5 pl-2 pr-1 py-0.5 text-[11px] text-accent"
      title="Режим фокуса"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent animate-pulse-soft" />
      <span className="truncate">Фокус · {title}</span>
      <button
        onClick={onExit}
        className="ml-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full hover:bg-accent/15"
        title="Выйти из фокуса (⌘⇧F)"
        aria-label="Выйти из фокуса"
      >
        <X size={10} />
      </button>
    </span>
  );
}

function DayProgress({ done, total }: { done: number; total: number }) {
  const pct = Math.round((done / total) * 100);
  const complete = done === total;
  return (
    <div
      className="ml-1 flex items-center gap-2"
      title={`Выполнено сегодня: ${done} из ${total}`}
    >
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            complete ? "bg-success" : "bg-accent",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-fg-subtle">
        {done}/{total}
      </span>
    </div>
  );
}

function EmptyState({
  zoomed,
  viewName,
}: {
  zoomed: boolean;
  viewName: string;
}) {
  return (
    <div className="mx-auto my-16 max-w-sm text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-bg-muted text-fg-subtle">
        ✨
      </div>
      <div className="text-sm font-medium">
        {zoomed ? "Подзадач пока нет" : `В «${viewName}» пусто`}
      </div>
      <div className="mt-1 text-xs text-fg-subtle">
        Добавь задачу ниже. <span className="kbd">Enter</span> — добавить.{" "}
        <span className="kbd">Tab</span> — сделать подзадачей.
      </div>
    </div>
  );
}
