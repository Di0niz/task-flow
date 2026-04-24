import { useMemo } from "react";
import { ChevronRight, Home } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { cn } from "../lib/utils";
import type { Task } from "../types";

export function Breadcrumbs() {
  const zoomStack = useAppStore((s) => s.zoomStack);
  const view = useAppStore((s) => s.view);
  const projects = useAppStore((s) => s.projects);
  const tasks = useAppStore((s) => s.tasks);
  const clearZoom = useAppStore((s) => s.clearZoom);
  const setView = useAppStore((s) => s.setView);
  const zoomTo = useAppStore((s) => s.zoomTo);

  const path = useMemo(() => {
    const leaf = zoomStack.length ? zoomStack[zoomStack.length - 1] : null;
    if (!leaf) return [] as Task[];
    const out: Task[] = [];
    let cur: Task | undefined = tasks[leaf];
    while (cur) {
      out.push(cur);
      cur = cur.parentId ? tasks[cur.parentId] : undefined;
    }
    return out.reverse();
  }, [zoomStack, tasks]);

  if (zoomStack.length === 0) return null;

  const rootLabel =
    view.kind === "project"
      ? (projects[view.id]?.name ?? "Проект")
      : view.id === "inbox"
        ? "Входящие"
        : view.id === "today"
          ? "Сегодня"
          : "Все";

  return (
    <nav className="flex items-center gap-1.5 text-xs text-fg-muted">
      <button
        className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-bg-muted"
        onClick={() => {
          clearZoom();
          setView(view);
        }}
      >
        <Home size={12} />
        <span>{rootLabel}</span>
      </button>
      {path.map((t, i) => {
        const isLast = i === path.length - 1;
        return (
          <div key={t.id} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-fg-subtle" />
            <button
              className={cn(
                "rounded px-1.5 py-0.5 max-w-[200px] truncate hover:bg-bg-muted transition-colors",
                isLast && "text-fg font-medium",
              )}
              onClick={() => zoomTo(t.id)}
              disabled={isLast}
            >
              {t.title || "Без названия"}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
