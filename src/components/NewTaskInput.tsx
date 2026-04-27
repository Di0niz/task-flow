import { useMemo, useState, useRef } from "react";
import { CalendarDays, Plus, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { parseTitleWithDate } from "../lib/parseDate";
import { extractTags } from "../lib/tags";
import type { ProjectId, TaskId } from "../types";

const LIST_PREFIX_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;

const INDENT = 24;

export function NewTaskInput({
  projectId,
  parentId,
  afterId,
  depth = 0,
  placeholder = "Новая задача… (#тег для метки)",
  autoFocus,
  markToday = false,
}: {
  projectId: ProjectId | null;
  parentId?: TaskId | null;
  afterId?: TaskId | null;
  depth?: number;
  placeholder?: string;
  autoFocus?: boolean;
  markToday?: boolean;
}) {
  const [value, setValue] = useState("");
  const [dateOverridden, setDateOverridden] = useState(false);
  const addTask = useAppStore((s) => s.addTask);
  const toggleTodayFlag = useAppStore((s) => s.toggleTodayFlag);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseLine = (raw: string) => {
    const stripped = raw.replace(LIST_PREFIX_RE, "").trim();
    const { title, tags } = extractTags(stripped);
    return { title: title || stripped, tags };
  };

  // Live date preview for the single-line case. Skipped if the user explicitly
  // cleared the chip (dateOverridden) to avoid re-surfacing what they rejected.
  const datePreview = useMemo(() => {
    if (dateOverridden) return null;
    const raw = value.trim();
    if (!raw) return null;
    const parsed = parseTitleWithDate(raw);
    if (!parsed.dueDate) return null;
    return { title: parsed.title, dueDate: parsed.dueDate };
  }, [value, dateOverridden]);

  const addLines = (lines: string[]) => {
    let cursor = afterId ?? null;
    lines.forEach((line, idx) => {
      // Use the preview only for the first line of a single-line submit.
      // Paste (multi-line) ignores the preview to keep that path simple.
      const useDatePreview = lines.length === 1 && idx === 0 && datePreview;
      const rawForTags = useDatePreview ? datePreview.title : line;
      const { title, tags } = parseLine(rawForTags);
      if (!title) return;
      const dueDate = useDatePreview ? datePreview.dueDate : undefined;
      const newId = addTask({ title, projectId, parentId, afterId: cursor, tags, dueDate });
      if (markToday) toggleTodayFlag(newId);
      cursor = newId;
    });
  };

  const submit = () => {
    const raw = value.trim();
    if (!raw) return;
    addLines([raw]);
    setValue("");
    setDateOverridden(false);
    inputRef.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    addLines(lines);
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <div
      className="group flex cursor-text items-center gap-1.5 py-[3px] pr-2"
      style={{ paddingLeft: depth * INDENT + 42 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName !== "INPUT") {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }}
    >
      <Plus
        size={14}
        className="shrink-0 text-fg-subtle transition-colors group-focus-within:text-fg-muted"
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (dateOverridden && e.target.value.trim() === "") {
            setDateOverridden(false);
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 bg-transparent text-[16px] leading-[24px] outline-none placeholder:text-fg-subtle"
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      {datePreview && (
        <button
          type="button"
          onClick={() => setDateOverridden(true)}
          className="inline-flex items-center gap-1 rounded border border-accent/30 bg-accent/5 px-1.5 py-0.5 text-[10px] text-accent hover:bg-accent/10 transition-colors"
          title="Убрать распознанную дату"
        >
          <CalendarDays size={11} />
          <span className="tabular-nums">
            {formatPreviewDate(datePreview.dueDate)}
          </span>
          <X size={10} className="opacity-70" />
        </button>
      )}
    </div>
  );
}

function formatPreviewDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
