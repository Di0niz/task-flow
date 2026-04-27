import { useEffect, useRef, useState } from "react";
import {
  Inbox,
  Star,
  CalendarDays,
  Layers,
  Archive,
  BarChart3,
  Plus,
  Settings,
  Search,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { PROJECT_COLORS, projectColorHex, type ViewKey } from "../types";
import { cn } from "../lib/utils";

type IconComponent = React.ComponentType<{
  size?: number | string;
  className?: string;
}>;

function NavItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  accent,
}: {
  icon: IconComponent;
  label: string;
  count?: number;
  active?: boolean;
  onClick(): void;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent/10 text-fg font-medium"
          : "text-fg-muted hover:bg-bg-muted/60 hover:text-fg",
      )}
    >
      {active && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-sm bg-accent"
          aria-hidden
        />
      )}
      <Icon
        size={16}
        className={cn(active ? "text-accent" : "text-fg-muted")}
      />
      <span className="flex-1 text-left truncate" style={accent ? { color: accent } : undefined}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "text-xs tabular-nums",
            active ? "text-fg-muted" : "text-fg-subtle",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const projects = useAppStore((s) => s.projects);
  const tasks = useAppStore((s) => s.tasks);
  const addProject = useAppStore((s) => s.addProject);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);

  const randomColor = () =>
    PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)].name;

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(() => randomColor());
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colorPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!colorPickerRef.current?.contains(e.target as Node)) {
        setColorPickerOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [colorPickerOpen]);

  const startCreating = () => {
    setNewColor(randomColor());
    setNewName("");
    setColorPickerOpen(false);
    setCreating(true);
  };

  const countsByProject = new Map<string, number>();
  let inboxCount = 0;
  let todayCount = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  Object.values(tasks).forEach((t) => {
    if (t.completed) return;
    if (t.projectId) {
      countsByProject.set(t.projectId, (countsByProject.get(t.projectId) ?? 0) + 1);
    } else {
      inboxCount += 1;
    }
    if (t.dueDate && new Date(t.dueDate).getTime() <= today.getTime() + 86400000) {
      todayCount += 1;
    }
  });

  const isActive = (v: ViewKey) => {
    if (view.kind !== v.kind) return false;
    return view.id === v.id;
  };

  const submitProject = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreating(false);
      return;
    }
    addProject(trimmed, newColor);
    setNewName("");
    setCreating(false);
  };

  const nextTheme =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-bg-soft">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-accent text-white text-xs font-bold">
            TF
          </div>
          <div className="text-sm font-semibold tracking-tight">TaskFlow</div>
        </div>
        <button
          className="btn-ghost p-1.5"
          title={`Тема: ${theme} (клик → ${nextTheme})`}
          onClick={() => setTheme(nextTheme)}
        >
          <ThemeIcon size={15} />
        </button>
      </div>

      <button
        className="mx-3 mt-1 mb-3 flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-fg-subtle hover:bg-bg-muted"
        onClick={() => setCommandPaletteOpen(true)}
      >
        <Search size={13} />
        <span className="flex-1 text-left">Поиск и команды</span>
        <span className="kbd">⌘K</span>
      </button>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2 pb-3">
        <div className="flex flex-col gap-0.5">
          <NavItem
            icon={Star}
            label="Сегодня"
            count={todayCount}
            active={isActive({ kind: "smart", id: "today" })}
            onClick={() => setView({ kind: "smart", id: "today" })}
          />
          <NavItem
            icon={Inbox}
            label="Входящие"
            count={inboxCount}
            active={isActive({ kind: "smart", id: "inbox" })}
            onClick={() => setView({ kind: "smart", id: "inbox" })}
          />
          <NavItem
            icon={CalendarDays}
            label="Предстоящее"
            active={isActive({ kind: "smart", id: "upcoming" })}
            onClick={() => setView({ kind: "smart", id: "upcoming" })}
          />
          <NavItem
            icon={Layers}
            label="Когда-нибудь"
            active={isActive({ kind: "smart", id: "anytime" })}
            onClick={() => setView({ kind: "smart", id: "anytime" })}
          />
          <NavItem
            icon={Archive}
            label="Журнал"
            active={isActive({ kind: "smart", id: "logbook" })}
            onClick={() => setView({ kind: "smart", id: "logbook" })}
          />
          <NavItem
            icon={BarChart3}
            label="Статистика"
            active={isActive({ kind: "smart", id: "stats" })}
            onClick={() => setView({ kind: "smart", id: "stats" })}
          />
        </div>

        <div className="mt-6 mb-1 flex items-center justify-between px-2.5">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle">
            Проекты
          </div>
          <button
            className="btn-ghost p-1"
            title="Новый проект"
            onClick={startCreating}
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="flex flex-col gap-0.5">
          {Object.values(projects)
            .filter((p) => !p.archived)
            .map((p) => {
              const colorHex = projectColorHex(p.color);
              const Dot: IconComponent = ({ size, className }) => {
                const px = typeof size === "number" ? size - 2 : 10;
                return (
                  <span
                    className={cn("inline-block rounded-full", className)}
                    style={{ width: px, height: px, background: colorHex }}
                  />
                );
              };
              return (
                <NavItem
                  key={p.id}
                  icon={Dot}
                  label={p.name}
                  count={countsByProject.get(p.id) ?? 0}
                  active={isActive({ kind: "project", id: p.id })}
                  onClick={() => setView({ kind: "project", id: p.id })}
                />
              );
            })}

          {creating && (
            <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1.5">
              <div ref={colorPickerRef} className="relative">
                <button
                  type="button"
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-offset-1 hover:ring-offset-bg hover:ring-border-strong",
                    colorPickerOpen && "ring-offset-1 ring-offset-bg ring-fg",
                  )}
                  style={{ background: projectColorHex(newColor) }}
                  title="Выбрать цвет"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setColorPickerOpen((o) => !o)}
                />
                {colorPickerOpen && (
                  <div className="absolute left-0 top-6 z-20 flex flex-col gap-1 rounded-md border border-border bg-bg-elevated p-1.5 shadow-lg animate-fade-in">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setNewColor(c.name);
                          setColorPickerOpen(false);
                        }}
                        className={cn(
                          "h-4 w-4 shrink-0 rounded-full ring-2 ring-transparent transition",
                          newColor === c.name &&
                            "ring-offset-1 ring-offset-bg-elevated ring-fg",
                        )}
                        style={{ background: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                )}
              </div>
              <input
                autoFocus
                value={newName}
                placeholder="Новый проект"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitProject();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                    setColorPickerOpen(false);
                  }
                }}
                onBlur={(e) => {
                  const next = e.relatedTarget as HTMLElement | null;
                  if (colorPickerRef.current?.contains(next)) return;
                  submitProject();
                }}
              />
            </div>
          )}
        </div>
      </nav>

      <div className="border-t border-border px-3 py-2 text-[11px] text-fg-subtle">
        <div className="flex items-center gap-1.5">
          <Settings size={12} />
          <span>Данные сохраняются локально</span>
        </div>
      </div>
    </aside>
  );
}
