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
import { formatDurationShort, formatRelative, parseDurationInput } from "../lib/time";
import { useNowTick } from "../hooks/useNowTick";
import { cn, todayIso } from "../lib/utils";
import { projectColorHex, type TaskId } from "../types";

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
  const addManualSession = useAppStore((s) => s.addManualSession);
  const removeSession = useAppStore((s) => s.removeSession);

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
  const [manualTimeDraft, setManualTimeDraft] = useState("");
  const [manualTimeError, setManualTimeError] = useState(false);

  if (!task) return null;

  const project = task.projectId ? projects[task.projectId] : null;
  const parent = task.parentId ? tasks[task.parentId] : null;
  const todayFlagged = task.todayDate === todayIso();
  const projectHex = project ? projectColorHex(project.color) : null;
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

  const submitManualTime = () => {
    const ms = parseDurationInput(manualTimeDraft);
    if (ms === null) {
      if (manualTimeDraft.trim()) setManualTimeError(true);
      return;
    }
    addManualSession(task.id, ms);
    setManualTimeDraft("");
    setManualTimeError(false);
  };

  return (
    <aside className="hidden lg:flex h-full w-80 shrink-0 flex-col border-l border-border bg-bg-soft">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          {focusedTaskId === task.id ? "Фокус" : "Детали задачи"}
        </span>
        <button
          onClick={handleClose}
          className="grid h-7 w-7 place-items-center rounded text-fg-muted hover:bg-bg-muted hover:text-fg transition-colors"
          title="Закрыть"
          aria-label="Закрыть"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Title — always shown as a labeled field so the inspector has a clear
            anchor even when zoomed. Styled as a form field, not a headline. */}
        <SectionLabel>Название</SectionLabel>
        <div className="flex items-start gap-2">
          <AutoSizeTextarea
            key={task.id}
            value={task.title}
            placeholder="Без названия"
            className="flex-1 min-w-0 resize-none rounded bg-transparent px-1.5 py-1 text-[13px] leading-[20px] text-fg outline-none placeholder:text-fg-subtle hover:bg-bg-muted/60 focus:bg-bg-muted/70 transition-colors"
            onBlur={handleTitleBlur}
          />
          {isUrl && (
            <a
              href={task.title.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 shrink-0 text-fg-muted hover:text-accent transition-colors"
              title="Открыть в новой вкладке"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          {project && projectHex && (
            <button
              className="inline-flex items-center gap-1.5 rounded-md bg-bg-muted/70 px-2 py-0.5 text-fg hover:bg-bg-muted transition-colors"
              onClick={() => useAppStore.getState().setView({ kind: "project", id: project.id })}
              title={`Открыть проект «${project.name}»`}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: projectHex }}
              />
              {project.name}
            </button>
          )}
          {!project && task.projectId === null && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-bg-muted/70 px-2 py-0.5 text-fg-muted">
              Входящие
            </span>
          )}
          {parent && (
            <button
              className="group/parent inline-flex max-w-[220px] items-center gap-1 rounded-md bg-bg-muted/70 px-2 py-0.5 text-fg-muted hover:bg-bg-muted hover:text-fg transition-colors"
              onClick={() => {
                clearZoom();
                zoomInto(parent.id);
              }}
              title={`К родителю: ${parent.title || "Без названия"}`}
              aria-label={`К родительской задаче: ${parent.title || "Без названия"}`}
            >
              <ChevronRight size={11} className="shrink-0 rotate-180 opacity-60 group-hover/parent:opacity-100" />
              <span className="text-fg-subtle">В:</span>
              <span className="truncate">{parent.title || "Без названия"}</span>
            </button>
          )}
        </div>

        {/* Dates row */}
        <div className="mt-5">
          <SectionLabel>Даты</SectionLabel>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-[12px] text-fg">
              <CalendarDays size={12} className="shrink-0 text-fg-muted" />
              <span className="w-14 shrink-0 text-fg-muted">Срок</span>
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
                  className="shrink-0 text-fg-muted hover:text-fg transition-colors"
                  title="Очистить дату"
                >
                  <X size={11} />
                </button>
              )}
            </label>
            <div className="flex items-center gap-2 text-[12px] text-fg">
              <Star
                size={12}
                className={cn(
                  "shrink-0",
                  todayFlagged ? "text-amber-400" : "text-fg-muted",
                )}
                fill={todayFlagged ? "currentColor" : "none"}
              />
              <span className="w-14 shrink-0 text-fg-muted">Сегодня</span>
              <button
                role="switch"
                aria-checked={todayFlagged}
                onClick={() => toggleTodayFlag(task.id)}
                className={cn(
                  "ml-auto inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
                  todayFlagged ? "bg-amber-400" : "bg-bg-muted ring-1 ring-inset ring-border",
                )}
                title={todayFlagged ? "Убрать из «Сегодня»" : "Добавить в «Сегодня»"}
                aria-label="Флаг «Сегодня»"
              >
                <span
                  className={cn(
                    "inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                    todayFlagged ? "translate-x-3.5" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-5">
          <SectionLabel icon={<TagIcon size={10} />}>Теги</SectionLabel>
          <div className="flex flex-wrap gap-1">
            {task.tags.map((t) => (
              <span
                key={t}
                className="group/tag inline-flex items-center gap-0.5 rounded bg-bg-muted/70 pl-1.5 pr-1 py-0.5 text-[11px] text-fg-muted"
              >
                <span>#{t}</span>
                <button
                  onClick={() => removeTag(t)}
                  className="grid h-3 w-3 place-items-center rounded text-fg-muted opacity-0 group-hover/tag:opacity-100 hover:text-fg transition-opacity"
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
              className="min-w-[60px] flex-1 rounded bg-transparent px-1 py-0.5 text-[11px] text-fg outline-none placeholder:text-fg-muted focus:bg-bg-muted/70"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mt-5">
          <SectionLabel>Заметки</SectionLabel>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={commitNotes}
            placeholder="Добавить заметку…"
            rows={notesDraft ? 4 : 2}
            className="w-full resize-y rounded-md border border-border bg-bg px-2.5 py-2 text-[12px] leading-[18px] text-fg outline-none placeholder:text-fg-muted hover:border-border-strong focus:border-border-strong transition-colors"
          />
        </div>

        {/* Time / sessions */}
        <div className="mt-5">
          <SectionLabel icon={<Timer size={10} />}>Время</SectionLabel>

          {/* Total — prominently displayed */}
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-fg-muted">Всего</span>
            <span
              className={cn(
                "font-mono tabular-nums text-[14px] font-medium",
                isTimerHere ? "text-danger" : "text-fg",
              )}
            >
              {formatDurationShort(totalMs) || "—"}
            </span>
          </div>

          {/* Sessions */}
          {task.sessions.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                <span>Сессии</span>
                <span className="tabular-nums">{task.sessions.length}</span>
              </div>
              <ul className="flex flex-col gap-0.5 text-[11px]">
                {task.sessions
                  .slice()
                  .sort((a, b) => b.startedAt - a.startedAt)
                  .slice(0, 8)
                  .map((s) => (
                    <li
                      key={s.id}
                      className="group/session flex items-center justify-between rounded px-1 py-0.5 text-fg-muted hover:bg-bg-muted/60"
                    >
                      <span>{formatRelative(s.startedAt)}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono tabular-nums text-fg">
                          {formatDurationShort(s.durationMs) || "0s"}
                        </span>
                        <button
                          onClick={() => removeSession(task.id, s.id)}
                          className="grid h-3.5 w-3.5 place-items-center rounded text-fg-muted opacity-0 group-hover/session:opacity-100 hover:text-fg transition-opacity"
                          title="Удалить сессию"
                          aria-label="Удалить сессию"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    </li>
                  ))}
                {task.sessions.length > 8 && (
                  <li className="px-1 text-[10px] text-fg-muted">
                    …и ещё {task.sessions.length - 8}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Manual time input */}
          <div className="mt-3">
            <div className="flex items-center gap-1">
              <input
                value={manualTimeDraft}
                onChange={(e) => {
                  setManualTimeDraft(e.target.value);
                  if (manualTimeError) setManualTimeError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitManualTime();
                  }
                }}
                onBlur={() => {
                  if (manualTimeDraft.trim()) submitManualTime();
                }}
                placeholder="Добавить время"
                className={cn(
                  "flex-1 min-w-0 rounded-md border bg-bg px-2 py-1 text-[11px] text-fg outline-none placeholder:text-fg-muted transition-colors",
                  manualTimeError
                    ? "border-danger/60 focus:border-danger"
                    : "border-border hover:border-border-strong focus:border-border-strong",
                )}
                title="Добавить время вручную, если забыли запустить таймер"
              />
              <button
                onClick={submitManualTime}
                disabled={!manualTimeDraft.trim()}
                className="grid h-6 w-6 place-items-center rounded-md border border-border bg-bg text-fg-muted hover:border-border-strong hover:bg-bg-muted hover:text-fg disabled:opacity-40 disabled:hover:bg-bg disabled:hover:text-fg-muted disabled:hover:border-border transition-colors"
                title="Добавить время"
                aria-label="Добавить время"
              >
                <Check size={12} />
              </button>
            </div>
            <p className="mt-1 px-0.5 text-[10px] text-fg-muted">
              Форматы: <span className="font-mono">30m</span> ·{" "}
              <span className="font-mono">1h 15m</span> ·{" "}
              <span className="font-mono">1:30</span>
            </p>
          </div>
        </div>

        {/* Footer meta */}
        <div className="mt-6 border-t border-border pt-3 text-[10px] text-fg-muted space-y-0.5">
          <div>
            Создана <span className="text-fg-subtle">·</span> {formatRelative(task.createdAt)}
          </div>
          <div>
            Изменена <span className="text-fg-subtle">·</span> {formatRelative(task.updatedAt)}
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

function SectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
      {icon}
      <span>{children}</span>
    </div>
  );
}

/**
 * Uncontrolled-feel textarea that mirrors `value` from props when it changes
 * externally and the field is not focused. Avoids the standard `defaultValue`
 * stale-data trap when the same task is updated from another surface (row
 * editor, drag-merge, etc).
 */
function AutoSizeTextarea({
  value,
  onBlur,
  className,
  placeholder,
}: {
  value: string;
  onBlur(e: React.FocusEvent<HTMLTextAreaElement>): void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Keep the textarea in sync with external value, but never clobber the user
  // mid-edit (i.e., when it is focused).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.value !== value) {
      el.value = value;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      defaultValue={value}
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

