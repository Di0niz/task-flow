import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { groupedHotkeys } from "../lib/hotkeys";

export function ShortcutsOverlay() {
  const open = useAppStore((s) => s.shortcutsOpen);
  const setOpen = useAppStore((s) => s.setShortcutsOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const groups = groupedHotkeys();

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/10 px-4 pt-24 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-lg bg-bg-elevated p-6 shadow-xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Горячие клавиши</h2>
          <span className="text-[10px] text-fg-muted">Esc чтобы закрыть</span>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.heading}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                {g.heading}
              </div>
              <dl className="space-y-1">
                {g.rows.map((hk) => (
                  <div key={hk.id} className="flex items-baseline justify-between gap-3">
                    <dt className="font-mono text-[11px] text-fg-muted">{hk.label}</dt>
                    <dd className="text-right text-[11px] text-fg">{hk.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
