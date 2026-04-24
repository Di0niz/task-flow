import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Hash, Folder, ChevronRight, Clock, Play, Square } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { cn } from "../lib/utils";

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  action(): void;
}

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);

  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);
  const activeTimer = useAppStore((s) => s.activeTimer);
  const setView = useAppStore((s) => s.setView);
  const zoomInto = useAppStore((s) => s.zoomInto);
  const startTimer = useAppStore((s) => s.startTimer);
  const stopTimer = useAppStore((s) => s.stopTimer);

  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    const ql = q.toLowerCase().trim();

    // Views
    const views: Item[] = [
      {
        id: "v-today",
        label: "Перейти: Сегодня",
        icon: <ChevronRight size={14} />,
        action: () => setView({ kind: "smart", id: "today" }),
      },
      {
        id: "v-inbox",
        label: "Перейти: Входящие",
        icon: <ChevronRight size={14} />,
        action: () => setView({ kind: "smart", id: "inbox" }),
      },
      {
        id: "v-stats",
        label: "Перейти: Статистика",
        icon: <ChevronRight size={14} />,
        action: () => setView({ kind: "smart", id: "stats" }),
      },
      {
        id: "v-logbook",
        label: "Перейти: Журнал",
        icon: <ChevronRight size={14} />,
        action: () => setView({ kind: "smart", id: "logbook" }),
      },
    ];

    Object.values(projects).forEach((p) => {
      views.push({
        id: `v-project-${p.id}`,
        label: `Проект: ${p.name}`,
        icon: <Folder size={14} />,
        action: () => setView({ kind: "project", id: p.id }),
      });
    });

    // Tasks
    const taskItems: Item[] = Object.values(tasks)
      .filter((t) => !t.completed)
      .filter((t) =>
        ql ? (t.title + " " + t.tags.join(" ")).toLowerCase().includes(ql) : true,
      )
      .slice(0, 50)
      .map((t) => ({
        id: `t-${t.id}`,
        label: t.title || "Без названия",
        hint: t.tags.length ? t.tags.map((x) => `#${x}`).join(" ") : undefined,
        icon: <Hash size={14} />,
        action: () => zoomInto(t.id),
      }));

    // Timer actions
    const timerItems: Item[] = Object.values(tasks)
      .filter((t) => !t.completed)
      .filter((t) => (ql ? ("таймер " + t.title).toLowerCase().includes(ql) : false))
      .slice(0, 10)
      .map((t) => ({
        id: `tm-${t.id}`,
        label: `Запустить таймер: ${t.title || "Задача"}`,
        icon: <Play size={14} />,
        action: () => startTimer(t.id),
      }));
    if (activeTimer) {
      timerItems.unshift({
        id: "tm-stop",
        label: "Остановить таймер",
        icon: <Square size={14} />,
        action: () => stopTimer(),
      });
    }

    if (ql) {
      out.push(...taskItems, ...timerItems, ...views.filter((v) => v.label.toLowerCase().includes(ql)));
    } else {
      out.push(...views, ...taskItems.slice(0, 20));
    }
    return out;
  }, [q, tasks, projects, activeTimer, setView, zoomInto, startTimer, stopTimer]);

  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [items.length, active]);

  if (!open) return null;

  const runActive = () => {
    const item = items[active];
    if (item) {
      item.action();
      setOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh] backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-[640px] max-w-[90vw] overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl animate-slide-up">
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          <Search size={16} className="text-fg-subtle" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск задач, проектов или команд…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                runActive();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-fg-subtle">
              Ничего не найдено
            </div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  setActive(i);
                  runActive();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm",
                  i === active
                    ? "bg-bg-muted text-fg"
                    : "text-fg-muted hover:bg-bg-muted/60",
                )}
              >
                <span className={i === active ? "text-accent" : "text-fg-subtle"}>
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && (
                  <span className="text-xs text-fg-subtle">{item.hint}</span>
                )}
                {i === active && <span className="kbd">↵</span>}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-fg-subtle">
          <div className="flex items-center gap-2">
            <span><span className="kbd">↑↓</span> навигация</span>
            <span><span className="kbd">↵</span> выбрать</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={11} />
            <span>{items.length} элементов</span>
          </div>
        </div>
      </div>
    </div>
  );
}
