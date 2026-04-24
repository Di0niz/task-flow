import { useEffect, useState } from "react";
import { Square } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { formatMs } from "../lib/time";
import { cn } from "../lib/utils";

const EXIT_MS = 180;

export function FloatingTimer() {
  const activeTimer = useAppStore((s) => s.activeTimer);
  const taskTitle = useAppStore((s) =>
    s.activeTimer ? (s.tasks[s.activeTimer.taskId]?.title ?? null) : null,
  );
  const stopTimer = useAppStore((s) => s.stopTimer);

  // Keep the card rendered while fading out, then unmount.
  const [mounted, setMounted] = useState(!!activeTimer);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (activeTimer) {
      setMounted(true);
      // Paint once with opacity-0/translate-y-2, then flip to trigger transition.
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const id = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [activeTimer]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeTimer) return;
    const h = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(h);
  }, [activeTimer]);

  if (!mounted) return null;

  const elapsed = activeTimer ? Math.max(0, now - activeTimer.startedAt) : 0;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-border-strong bg-bg-elevated px-4 py-3 shadow-lg transition-[opacity,transform] duration-150 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-danger/70" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="font-mono text-lg font-semibold leading-none tabular-nums">
          {formatMs(elapsed)}
        </span>
        <span className="mt-1 max-w-[240px] truncate text-xs text-fg-muted">
          {taskTitle ?? "(задача удалена)"}
        </span>
      </div>
      <button
        type="button"
        onClick={stopTimer}
        className="ml-2 inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-xs font-medium text-white transition-[filter] hover:brightness-110"
        title="Остановить таймер"
      >
        <Square size={11} fill="currentColor" strokeWidth={0} />
        Стоп
      </button>
    </div>
  );
}
