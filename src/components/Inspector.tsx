import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  ExternalLink,
  Star,
  Tag as TagIcon,
  Timer,
  X,
} from "lucide-react";
import { useAppStore, selectZoomedTaskId } from "../store/useAppStore";
import { totalTaskMs } from "../lib/aggregate";
import { formatDurationShort } from "../lib/time";
import { useNowTick } from "../hooks/useNowTick";
import { cn, todayIso } from "../lib/utils";
import { PROJECT_COLORS, type TaskId } from "../types";

const URL_ONLY_RE = /^https?:\/\/\S+$/;

export function Inspector() {
  const focusedTaskId = useAppStore((s) => s.focusedTaskId);
  const zoomedId = useAppStore(selectZoomedTaskId);
  const activeId: TaskId | null = focusedTaskId ?? zoomedId;

  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const activeTimer = useAppStore((s) => s.activeTimer);

  const updateTask = useAppStore((s) => s.updateTask);
  const toggleTodayFlag = useAppStore((s) => s.toggleTodayFlag);
  const setFocusedTask = useAppStore((s) => s.setFocusedTask);
  const clearZoom = useAppStore((s) => s.clearZoom);
  const zoomInto = useAppStore((s) => s.zoomInto);

  const task = activeId ? tasks[activeId] : null;

  // Live ticking total time when the timer is inside this subtree.
  const isTimerHere = !!activeTimer && !!task && activeTimer.taskId === task.id;
  const now = useNowTick(isTimerHere);
  const totalMs = useMemo(() => {
    if (!task) return 0;
    return totalTaskMs(task.id, tasks, activeTimer, now);
  }, [task, tasks, activeTimer, now]);

  const [notesDraft, setNotesDraft] = useState("");
  useEffect(() => {
    setNotesDraft(task?.notes ?? "");
  }, [task?.id, task?.notes]);

  const [newTagDraft, setNewTagDraft] = useState("");

  if (!task) return null;

  const project = task.projectId ? projects[task.projectId] : null;
  const parent = task.parentId ? tasks[task.parentId] : null;
  const todayFlagged = task.todayDate === todayIso();
  const projectHex = project
    ? (PROJECT_COLORS.find((c) => c.name === project.color)?.hex ?? "#888")
    : null;
  const isUrl = URL_ONLY_RE.test(task.title.trim());

  const commitNotes = () => {
    if (notesDraft === (task.notes ?? "")) return;
    updateTask(task.id, { notes: notesDraft });
  };

  const handleTitleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const value = e.currentTarget.value.trim();
    if (value === task.title) return;
    updateTask(task.id, { title: value });
  };

  const handleClose = () => {
    if (focusedTaskId === task.id) setFocusedTask(null);
    else if (zoomedId === task.id) clearZoom();
  };

  const addTag = () => {
    const raw = newTagDraft.trim().replace(/^#/, "");
    if (!raw) return;
    if (task.tags.includes(raw)) {
      setNewTagDraft("");
      return;
    }
    updateTask(task.id, { tags: [...task.tags, raw] });
    setNewTagDraft("");
  };

  const removeTag = (tag: string) => {
    updateTask(task.id, { tags: task.tags.filter((t) => t !== tag) });
  };

  return (
    <aside className="hidden lg:flex h-full w-80 shrink-0 flex-col border-l border-border bg-bg-soft">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[11px] uppercase tracking-wider text-fg-subtle">
          {focusedTaskId === task.id ? "Фокус" : "Детали задачи"}
        </span>
        <button
          onClick={handleClose}
          className="grid h-6 w-6 place-items-center rounded text-fg-subtle hover:bg-bg-muted hover:text-fg-muted transition-colors"
          title="Закрыть"
          aria-label="Закрыть"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Title */}
        <div className="flex items-start gap-2">
          <AutoSizeTextarea
            key={task.id}
            defaultValue={task.title}
            placeholder="Без названия"
            className="flex-1 min-w-0 resize-none bg-transparent text-[15px] font-medium leading-[22px] outline-none placeholder:text-fg-subtle"
            onBlur={handleTitleBlur}
          />
          {isUrl && (
            <a
              href={task.title.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 shrink-0 text-fg-subtle hover:text-accent transition-colors"
              title="Открыть в новой вкладке"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {project && projectHex && (
            <button
              className="inline-flex items-center gap-1.5 rounded-md bg-bg-muted/70 px-2 py-0.5 text-fg-muted hover:bg-bg-muted transition-colors"
              onClick={() => useAppStore.getState().setView({ kind: "project", id: project.id })}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: projectHex }}
              />
              {project.name}
            </button>
          )}
          {!project && task.projectId === null && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-bg-muted/70 px-2 py-0.5 text-fg-subtle">
              Входящие
            </span>
          )}
          {parent && (
            <button
              className="inline-flex max-w-[180px] items-center gap-1 rounded-md bg-bg-muted/70 px-2 py-0.5 text-fg-muted hover:bg-bg-muted transition-colors"
              onClick={() => {
                // Navigate up to the parent: clear zoom, then zoom to parent.
                clearZoom();
                zoomInto(parent.id);
              }}
              title="К родителю"
            >
              <ChevronRight size={11} className="shrink-0 rotate-180" />
              <span className="truncate">{parent.title || "Без названия"}</span>
            </button>
          )}
        </div>

        {/* Dates row */}
        <div className="mt-4">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Даты
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-[12px] text-fg-muted">
              <CalendarDays size={12} className="shrink-0 text-fg-subtle" />
              <span className="w-14 shrink-0 text-fg-subtle">Срок</span>
              <input
                type="date"
                value={task.dueDate ?? ""}
                onChange={(e) =>
                  updateTask(task.id, { dueDate: e.target.value || undefined })
                }
                className="flex-1 min-w-0 rounded bg-transparent text-[12px] text-fg outline-none hover:bg-bg-muted/70 focus:bg-bg-muted/70 transition-colors"
              />
              {task.dueDate && (
                <button
                  onClick={() => updateTask(task.id, { dueDate: undefined })}
                  className="shrink-0 text-fg-subtle hover:text-fg-muted transition-colors"
                  title="Очистить дату"
                >
                  <X size={11} />
                </button>
              )}
            </label>
            <button
              onClick={() => toggleTodayFlag(task.id)}
              className={cn(
                "flex items-center gap-2 rounded px-0 py-0.5 text-left text-[12px] transition-colors",
                todayFlagged
                  ? "text-amber-500 hover:text-amber-400"
                  : "text-fg-muted hover:text-fg",
              )}
              title={todayFlagged ? "Убрать из «Сегодня»" : "Добавить в «Сегодня»"}
            >
              <Star size={12} fill={todayFlagged ? "currentColor" : "none"} />
              <span className="w-14 shrink-0 text-fg-subtle">Сегодня</span>
              <span>{todayFlagged ? "да" : "нет"}</span>
            </button>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            <TagIcon size={10} />
            <span>Теги</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {task.tags.map((t) => (
              <span
                key={t}
                className="group/tag inline-flex items-center gap-0.5 rounded bg-bg-muted/70 pl-1.5 pr-1 py-0.5 text-[11px] text-fg-muted"
              >
                <span>#{t}</span>
                <button
                  onClick={() => removeTag(t)}
                  className="grid h-3 w-3 place-items-center rounded text-fg-subtle opacity-0 group-hover/tag:opacity-100 hover:text-fg transition-opacity"
                  title={`Удалить тег #${t}`}
                  aria-label={`Удалить тег ${t}`}
                >
                  <X size={9} />
                </button>
              </span>
            ))}
            <input
              value={newTagDraft}
              onChange={(e) => setNewTagDraft(e.target.value.replace(/\s+/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="+ тег"
              className="min-w-[60px] flex-1 rounded bg-transparent px-1 py-0.5 text-[11px] outline-none placeholder:text-fg-subtle focus:bg-bg-muted/70"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Заметки
          </div>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={commitNotes}
            placeholder="Добавить заметку…"
            rows={4}
            className="w-full resize-y rounded-md border border-transparent bg-bg px-2.5 py-2 text-[12px] leading-[18px] text-fg outline-none placeholder:text-fg-subtle hover:border-border focus:border-border-strong transition-colors"
          />
        </div>

        {/* Time / sessions */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            <Timer size={10} />
            <span>Время</span>
          </div>
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="text-fg-subtle">Всего по дереву</span>
            <span
              className={cn(
                "font-mono tabular-nums",
                isTimerHere ? "text-danger" : "text-fg",
              )}
            >
              {formatDurationShort(totalMs) || "—"}
            </span>
          </div>
          {task.sessions.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-[11px]">
              {task.sessions
                .slice()
                .sort((a, b) => b.startedAt - a.startedAt)
                .slice(0, 8)
                .map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded px-1 py-0.5 text-fg-subtle hover:bg-bg-muted/60"
                  >
                    <span>{formatRelative(s.startedAt)}</span>
                    <span className="font-mono tabular-nums text-fg-muted">
                      {formatDurationShort(s.durationMs) || "0s"}
                    </span>
                  </li>
                ))}
              {task.sessions.length > 8 && (
                <li className="px-1 text-[10px] text-fg-subtle">
                  …и ещё {task.sessions.length - 8}
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Footer meta */}
        <div className="mt-6 border-t border-border pt-3 text-[10px] text-fg-subtle space-y-0.5">
          <div>
            Создана {formatRelative(task.createdAt)}
          </div>
          <div>
            Изменена {formatRelative(task.updatedAt)}
          </div>
          {task.completed && task.completedAt && (
            <div className="inline-flex items-center gap-1 text-success">
              <Check size={10} />
              Выполнена {formatRelative(task.completedAt)}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function AutoSizeTextarea({
  defaultValue,
  onBlur,
  className,
  placeholder,
}: {
  defaultValue: string;
  onBlur(e: React.FocusEvent<HTMLTextAreaElement>): void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [defaultValue]);
  return (
    <textarea
      ref={ref}
      defaultValue={defaultValue}
      rows={1}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      onBlur={onBlur}
      placeholder={placeholder}
      className={className}
    />
  );
}

function formatRelative(ts: number): string {
  const delta = Date.now() - ts;
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн назад`;
  return new Date(ts).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
