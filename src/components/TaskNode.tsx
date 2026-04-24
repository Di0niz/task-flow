import { useEffect, useRef, useState } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Maximize2,
  Play,
  MoreHorizontal,
  Square,
  Star,
} from "lucide-react";

import { useAppStore } from "../store/useAppStore";
import { cn, todayIso } from "../lib/utils";
import { formatDurationShort } from "../lib/time";
import { isInSubtree, totalTaskMs } from "../lib/aggregate";
import { useNowTick } from "../hooks/useNowTick";
import {
  caretAtEnd,
  caretAtStart,
  focusAt,
  focusTaskById,
  getAdjacentTaskId,
  getEditableFor,
} from "../lib/caret";

import { TagChip } from "./TagChip";
import { extractTags } from "../lib/tags";
import type { TaskId } from "../types";

const INDENT = 24; // px per depth level

const URL_ONLY_RE = /^https?:\/\/\S+$/;

function pluralSessions(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "сессия";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "сессии";
  return "сессий";
}

interface Props {
  id: TaskId;
  depth: number;
  /** Whether the task should request focus on mount (e.g., newly created). */
  autoFocus?: boolean;
}

export function TaskNode({ id, depth, autoFocus }: Props) {
  const task = useAppStore((s) => s.tasks[id]);
  const allTasks = useAppStore((s) => s.tasks);
  const activeTimer = useAppStore((s) => s.activeTimer);

  const focusedTaskId = useAppStore((s) => s.focusedTaskId);
  const setFocusedTask = useAppStore((s) => s.setFocusedTask);

  const toggleTask = useAppStore((s) => s.toggleTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const addTask = useAppStore((s) => s.addTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const duplicateTask = useAppStore((s) => s.duplicateTask);
  const mergeTaskIntoTarget = useAppStore((s) => s.mergeTaskIntoTarget);
  const toggleTodayFlag = useAppStore((s) => s.toggleTodayFlag);
  const setCollapsed = useAppStore((s) => s.setCollapsed);
  const toggleCollapsed = useAppStore((s) => s.toggleCollapsed);
  const indentTask = useAppStore((s) => s.indentTask);
  const outdentTask = useAppStore((s) => s.outdentTask);
  const moveTaskUp = useAppStore((s) => s.moveTaskUp);
  const moveTaskDown = useAppStore((s) => s.moveTaskDown);
  const zoomInto = useAppStore((s) => s.zoomInto);
  const startTimer = useAppStore((s) => s.startTimer);
  const stopTimer = useAppStore((s) => s.stopTimer);
  const showCompleted = useAppStore((s) => s.filter.showCompleted);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const editRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (autoFocus && editRef.current) {
      focusAt(editRef.current, "end");
    }
  }, [autoFocus]);

  // Auto-clean legacy titles that still contain unextracted #tags.
  useEffect(() => {
    if (!task || !task.title.includes("#")) return;
    if (document.activeElement === editRef.current) return; // don't fight user input
    const { title, tags } = extractTags(task.title);
    if (title === task.title && tags.length === 0) return;
    const merged = tags.length
      ? Array.from(new Set([...task.tags, ...tags]))
      : task.tags;
    updateTask(id, { title, tags: merged });
  }, [task, id, updateTask]);

  if (!task) return null;

  const hasChildren = task.childrenIds.length > 0;
  const visibleChildren = showCompleted
    ? task.childrenIds
    : task.childrenIds.filter((cid) => {
        const c = allTasks[cid];
        return c && !c.completed;
      });

  const onTitleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = editRef.current;
    const mod = e.metaKey || e.ctrlKey;
    const text = el?.innerText ?? "";

    // Space: if caret is just after #word, convert it to a tag
    if (e.key === " " && !mod && !e.shiftKey && !e.altKey && el) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        if (r.collapsed) {
          const pre = r.cloneRange();
          pre.selectNodeContents(el);
          pre.setEnd(r.endContainer, r.endOffset);
          const before = pre.toString();
          const m = before.match(/(?:^|\s)#([A-Za-zА-Яа-яЁё0-9_-]+)$/);
          if (m) {
            e.preventDefault();
            const tag = m[1];
            const startIdx = before.length - m[0].length;
            const caret = startIdx;
            const full = el.innerText;
            const cleaned = full.slice(0, startIdx) + full.slice(before.length);
            const nextTags = task.tags.includes(tag) ? task.tags : [...task.tags, tag];
            updateTask(id, { title: cleaned, tags: nextTags });
            requestAnimationFrame(() => {
              const el2 = getEditableFor(id);
              if (el2) focusAt(el2, caret);
            });
            return;
          }
        }
      }
    }

    // Enter → new task below (or as first child if expanded+has children); focus it
    if (e.key === "Enter" && !e.shiftKey && !mod && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const { title: cleanedTitle, tags: extracted } = extractTags(text);
      const mergedTags = extracted.length
        ? Array.from(new Set([...task.tags, ...extracted]))
        : task.tags;
      updateTask(id, { title: cleanedTitle, tags: mergedTags });
      const newId =
        hasChildren && !task.collapsed
          ? addTask({ title: "", projectId: task.projectId, parentId: id, afterId: null })
          : addTask({ title: "", projectId: task.projectId, parentId: task.parentId, afterId: id });
      requestAnimationFrame(() => focusTaskById(newId, "start"));
      return;
    }

    // Tab / Shift+Tab → indent/outdent
    if (e.key === "Tab") {
      e.preventDefault();
      updateTask(id, { title: text });
      if (e.shiftKey) outdentTask(id);
      else indentTask(id);
      requestAnimationFrame(() => focusTaskById(id, "end"));
      return;
    }

    // ⌘↩ → toggle completed
    if (mod && !e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      toggleTask(id);
      return;
    }

    // ⌘⇧. → zoom in
    if (mod && e.shiftKey && (e.key === "." || e.key === ">")) {
      e.preventDefault();
      updateTask(id, { title: text });
      zoomInto(id);
      return;
    }

    // ⌘⇧↑ / ⌘⇧↓ → move task
    if (mod && e.shiftKey && e.key === "ArrowUp") {
      e.preventDefault();
      updateTask(id, { title: text });
      moveTaskUp(id);
      requestAnimationFrame(() => focusTaskById(id, "end"));
      return;
    }
    if (mod && e.shiftKey && e.key === "ArrowDown") {
      e.preventDefault();
      updateTask(id, { title: text });
      moveTaskDown(id);
      requestAnimationFrame(() => focusTaskById(id, "end"));
      return;
    }

    // ⌘⇧→ / ⌘⇧← → expand / collapse
    if (mod && e.shiftKey && e.key === "ArrowRight") {
      if (hasChildren && task.collapsed) {
        e.preventDefault();
        setCollapsed(id, false);
      }
      return;
    }
    if (mod && e.shiftKey && e.key === "ArrowLeft") {
      if (hasChildren && !task.collapsed) {
        e.preventDefault();
        setCollapsed(id, true);
      }
      return;
    }

    // ⌘D → duplicate
    if (mod && !e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      updateTask(id, { title: text });
      const dupId = duplicateTask(id);
      if (dupId) requestAnimationFrame(() => focusTaskById(dupId, "end"));
      return;
    }

    // ↑ / ↓ — move caret between tasks when at edge
    if (e.key === "ArrowUp" && !mod && !e.shiftKey && !e.altKey) {
      if (el && caretAtStart(el)) {
        const prevId = getAdjacentTaskId(id, -1);
        if (prevId) {
          e.preventDefault();
          updateTask(id, { title: text });
          focusTaskById(prevId, "end");
        }
      }
      return;
    }
    if (e.key === "ArrowDown" && !mod && !e.shiftKey && !e.altKey) {
      if (el && caretAtEnd(el)) {
        const nextId = getAdjacentTaskId(id, 1);
        if (nextId) {
          e.preventDefault();
          updateTask(id, { title: text });
          focusTaskById(nextId, "start");
        }
      }
      return;
    }

    // Backspace — delete if empty, merge with previous if at start of non-empty
    if (e.key === "Backspace" && !mod && !e.shiftKey) {
      if (text === "") {
        e.preventDefault();
        const prevId = getAdjacentTaskId(id, -1);
        deleteTask(id);
        if (prevId) requestAnimationFrame(() => focusTaskById(prevId, "end"));
        return;
      }
      if (el && caretAtStart(el)) {
        const prevId = getAdjacentTaskId(id, -1);
        if (!prevId) return;
        const prevTitle = useAppStore.getState().tasks[prevId]?.title ?? "";
        e.preventDefault();
        updateTask(id, { title: text });
        mergeTaskIntoTarget(id, prevId);
        requestAnimationFrame(() => focusTaskById(prevId, prevTitle.length));
        return;
      }
    }

    // Escape → blur
    if (e.key === "Escape") {
      e.preventDefault();
      updateTask(id, { title: text });
      el?.blur();
      return;
    }
  };

  const onTitleBlur = () => {
    const raw = (editRef.current?.innerText ?? "").replace(/\n+$/, "");
    const { title, tags } = extractTags(raw);
    const merged = tags.length
      ? Array.from(new Set([...task.tags, ...tags]))
      : task.tags;

    // Auto-delete shell tasks: empty + no children + no metadata of any kind.
    const isShell =
      title.trim() === "" &&
      task.childrenIds.length === 0 &&
      merged.length === 0 &&
      task.sessions.length === 0 &&
      !task.dueDate &&
      !task.todayDate &&
      !task.completed &&
      !task.notes;
    if (isShell) {
      deleteTask(id);
      return;
    }

    updateTask(id, { title, tags: merged });
  };

  const STALE_DAYS = 3;
  const daysSinceUpdate = (Date.now() - task.updatedAt) / 86400000;
  const isStale = !task.completed && daysSinceUpdate > STALE_DAYS;
  const staleDaysLabel = Math.floor(daysSinceUpdate);

  const isTimerHere = activeTimer?.taskId === id;
  const timerInsideSubtree = !!activeTimer && isInSubtree(id, activeTimer.taskId, allTasks);
  const now = useNowTick(timerInsideSubtree);
  const totalMs = totalTaskMs(id, allTasks, activeTimer, now);
  const totalLabel = totalMs > 0 ? formatDurationShort(totalMs) : "";

  const sessionsCount = (() => {
    let n = task.sessions.length;
    const descIds = [] as TaskId[];
    const stack = [...task.childrenIds];
    while (stack.length) {
      const cid = stack.pop()!;
      descIds.push(cid);
      const c = allTasks[cid];
      if (c) stack.push(...c.childrenIds);
    }
    descIds.forEach((d) => (n += allTasks[d]?.sessions.length ?? 0));
    if (isTimerHere || timerInsideSubtree) n += 1;
    return n;
  })();
  const timeTooltip = totalLabel
    ? `Потрачено: ${totalLabel}${sessionsCount ? ` · ${sessionsCount} ${pluralSessions(sessionsCount)}` : ""}`
    : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative", isDragging && "z-30 opacity-60")}
    >
      <div
        className={cn(
          "group/row relative flex cursor-text items-start gap-1.5 rounded-[4px] py-[5px] pr-2 transition-colors",
          "hover:bg-bg-muted/70",
          isTimerHere && "bg-bg-muted",
          focusedTaskId === id && "bg-accent/5 ring-1 ring-accent/20",
        )}
        style={{ paddingLeft: depth * INDENT + 42 }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          const target = e.target as HTMLElement;
          if (target.closest("button, a, [contenteditable]")) return;
          e.preventDefault();
          if (editRef.current) focusAt(editRef.current, "end");
        }}
      >
        {/* Focus mode — accent bar on the left */}
        {focusedTaskId === id && (
          <span
            className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm bg-accent"
            aria-hidden
          />
        )}

        {/* Today flag — absolute at far left; visible if flagged or on row hover */}
        {(() => {
          const flagged = task.todayDate === todayIso();
          return (
            <button
              className={cn(
                "absolute top-[7px] grid h-[18px] w-[18px] place-items-center rounded transition-opacity",
                flagged
                  ? "text-amber-400 opacity-100"
                  : "text-fg-subtle opacity-0 group-hover/row:opacity-100 hover:text-amber-400",
              )}
              style={{ left: depth * INDENT }}
              onClick={() => toggleTodayFlag(id)}
              title={flagged ? "Убрать из «Сегодня»" : "Добавить в «Сегодня»"}
              tabIndex={-1}
            >
              <Star size={12} fill={flagged ? "currentColor" : "none"} />
            </button>
          );
        })()}

        {/* Chevron — visible only on row hover (or when collapsed, to hint expandability) */}
        {hasChildren && (
          <button
            className={cn(
              "absolute top-[10px] text-fg-subtle hover:text-fg transition-opacity",
              task.collapsed
                ? "opacity-100"
                : "opacity-0 group-hover/row:opacity-100",
            )}
            style={{ left: depth * INDENT + 24 }}
            onClick={() => toggleCollapsed(id)}
            aria-label={task.collapsed ? "Раскрыть" : "Свернуть"}
            tabIndex={-1}
          >
            {task.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        {/* Bullet — filled dot. Click = zoom, drag = move (Workflowy-style).
            Collapsed = halo ring to indicate hidden children. */}
        <button
          className={cn(
            "mt-[9px] h-[7px] w-[7px] shrink-0 rounded-full transition-[background-color,box-shadow] duration-300 cursor-grab active:cursor-grabbing",
            task.completed ? "bg-fg-subtle" : "bg-fg/70 hover:bg-fg",
            hasChildren && task.collapsed && "ring-[3px] ring-fg-subtle/40",
          )}
          title="Zoom in ⌘⇧."
          onClick={() => zoomInto(id)}
          {...attributes}
          {...listeners}
          aria-label="Переместить или перейти внутрь"
          tabIndex={-1}
        />

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              onKeyDown={onTitleKey}
              onBlur={onTitleBlur}
              data-task-id={id}
              data-placeholder="Без названия"
              className={cn(
                "placeholder min-w-[40px] max-w-full text-[16px] leading-[24px] outline-none break-words whitespace-pre-wrap",
                "transition-colors duration-300",
                task.completed && "line-through decoration-fg-subtle text-fg-subtle",
              )}
            >
              {task.title}
            </div>

            {task.tags.length > 0 && (
              <div className="flex gap-1">
                {task.tags.map((t) => (
                  <TagChip key={t} tag={t} size="xs" />
                ))}
              </div>
            )}

            {task.dueDate && !task.completed && (
              <span className="text-[10px] text-fg-subtle">
                {new Date(task.dueDate).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}

            {URL_ONLY_RE.test(task.title.trim()) && (
              <a
                href={task.title.trim()}
                target="_blank"
                rel="noopener noreferrer"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center text-fg-subtle hover:text-accent transition-colors"
                title="Открыть в новой вкладке"
                tabIndex={-1}
              >
                <ExternalLink size={11} />
              </a>
            )}

            {isStale && (
              <span
                className="inline-flex h-1.5 w-1.5 rounded-full bg-warning/60"
                title={`Не обновлялась ${staleDaysLabel} дн. — разбить на подзадачи?`}
                aria-label="зависшая задача"
              />
            )}
          </div>
        </div>

        {/* Elapsed time + row actions */}
        <div className="flex items-center gap-1.5">
          {totalLabel && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-mono text-[11px] tabular-nums",
                isTimerHere ? "text-danger" : "text-fg-subtle",
              )}
              title={timeTooltip}
            >
              <Clock size={11} strokeWidth={1.75} className="opacity-70" />
              {totalLabel}
            </span>
          )}
          <div className="flex items-center gap-0.5">
            {isTimerHere ? (
              <RowAction
                title="Остановить таймер"
                onClick={() => stopTimer()}
                className="text-white bg-danger hover:brightness-110 hover:bg-danger"
              >
                <Square size={10} fill="currentColor" strokeWidth={0} />
              </RowAction>
            ) : (
              <RowAction
                title="Запустить таймер"
                onClick={() => startTimer(id)}
                className="opacity-0 group-hover/row:opacity-100 text-accent hover:text-accent"
              >
                <Play size={12} fill="currentColor" strokeWidth={0} />
              </RowAction>
            )}
            <RowAction
              title="Zoom in"
              onClick={() => zoomInto(id)}
              className="opacity-0 group-hover/row:opacity-100"
            >
              <Maximize2 size={12} />
            </RowAction>
            <div className="relative">
              <RowAction
                title="Меню"
                onClick={() => setMenuOpen((o) => !o)}
                className="opacity-0 group-hover/row:opacity-100"
              >
                <MoreHorizontal size={12} />
              </RowAction>
            {menuOpen && (
              <div
                className="absolute right-0 top-7 z-20 w-48 rounded-md border border-border bg-bg-elevated p-1 text-sm shadow-lg animate-fade-in"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <MenuItem
                  onClick={() => {
                    toggleTask(id);
                    setMenuOpen(false);
                  }}
                >
                  {task.completed ? "Снять отметку" : "Отметить выполненной"}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setFocusedTask(focusedTaskId === id ? null : id);
                    setMenuOpen(false);
                  }}
                >
                  {focusedTaskId === id ? "Выйти из фокуса" : "Режим фокуса"}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    const raw = prompt("Дата (YYYY-MM-DD)", task.dueDate ?? "");
                    if (raw !== null) updateTask(id, { dueDate: raw || undefined });
                    setMenuOpen(false);
                  }}
                >
                  Поставить дату
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    const raw = prompt("Теги через запятую", task.tags.join(", "));
                    if (raw !== null) {
                      updateTask(id, {
                        tags: raw.split(",").map((t) => t.trim()).filter(Boolean),
                      });
                    }
                    setMenuOpen(false);
                  }}
                >
                  Редактировать теги
                </MenuItem>
                <div className="my-1 h-px bg-border" />
                <MenuItem
                  danger
                  onClick={() => {
                    if (confirm(`Удалить «${task.title || "задачу"}»?`)) {
                      deleteTask(id);
                    }
                    setMenuOpen(false);
                  }}
                >
                  Удалить
                </MenuItem>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {hasChildren && !task.collapsed && (
        <div>
          <SortableContext items={visibleChildren} strategy={verticalListSortingStrategy}>
            {visibleChildren.map((cid) => (
              <TaskNode key={cid} id={cid} depth={depth + 1} />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

function RowAction({
  title,
  onClick,
  children,
  className,
}: {
  title: string;
  onClick(): void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      className={cn(
        "grid h-6 w-6 place-items-center rounded text-fg-subtle transition-[color,background,opacity,filter]",
        "hover:bg-bg-muted hover:text-fg-muted",
        className,
      )}
      onClick={onClick}
      title={title}
      tabIndex={-1}
    >
      {children}
    </button>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick(): void;
  danger?: boolean;
}) {
  return (
    <button
      className={cn(
        "block w-full rounded px-2 py-1 text-left text-xs hover:bg-bg-muted",
        danger ? "text-danger" : "text-fg-muted hover:text-fg",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
