import { useMemo } from "react";
import { CalendarDays, CheckCircle2, Target, Timer } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { formatDuration, cn } from "../lib/utils";
import { projectColorHex, type ProjectId, type TaskId } from "../types";

/** Returns the start of the ISO week (Monday 00:00 local time) for a given Date. */
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  // JS: Sunday=0, Monday=1, ..., Saturday=6. ISO week starts on Monday.
  const dayOfWeek = (out.getDay() + 6) % 7; // 0 for Mon, 6 for Sun
  out.setDate(out.getDate() - dayOfWeek);
  return out;
}

interface FlatSession {
  taskId: TaskId;
  projectId: ProjectId | null;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
}

export function Stats() {
  const tasks = useAppStore((s) => s.tasks);
  const projects = useAppStore((s) => s.projects);

  const sessions = useMemo<FlatSession[]>(() => {
    const out: FlatSession[] = [];
    for (const t of Object.values(tasks)) {
      for (const s of t.sessions) {
        out.push({
          taskId: t.id,
          projectId: t.projectId,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          durationSeconds: Math.floor(s.durationMs / 1000),
        });
      }
    }
    return out;
  }, [tasks]);

  const todayMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const weekStartMs = useMemo(() => startOfWeek(new Date(todayMs)).getTime(), [todayMs]);

  const todaySessions = sessions.filter((s) => s.startedAt >= todayMs);
  const weekSessions = sessions.filter((s) => s.startedAt >= weekStartMs);

  const completedToday = Object.values(tasks).filter(
    (t) => t.completed && (t.completedAt ?? 0) >= todayMs,
  ).length;

  const focusToday = todaySessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const focusWeek = weekSessions.reduce((sum, s) => sum + s.durationSeconds, 0);

  const weekDays = useMemo(() => {
    const days: { label: string; dateMs: number; seconds: number }[] = [];
    const baseDate = new Date(todayMs);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const end = new Date(d);
      end.setDate(d.getDate() + 1);
      const s = sessions
        .filter((x) => x.startedAt >= d.getTime() && x.startedAt < end.getTime())
        .reduce((sum, x) => sum + x.durationSeconds, 0);
      days.push({
        label: d.toLocaleDateString("ru-RU", { weekday: "short" }),
        dateMs: d.getTime(),
        seconds: s,
      });
    }
    return days;
  }, [sessions, todayMs]);

  const maxDay = Math.max(1, ...weekDays.map((d) => d.seconds));

  const byProject = useMemo(() => {
    const acc: Record<string, number> = {};
    sessions.forEach((s) => {
      const key = s.projectId ?? "inbox";
      acc[key] = (acc[key] ?? 0) + s.durationSeconds;
    });
    return Object.entries(acc)
      .map(([id, seconds]) => {
        if (id === "inbox") {
          return { id, name: "Входящие", color: "#64748b", seconds };
        }
        const project = projects[id as ProjectId];
        return {
          id,
          name: project?.name ?? "(удалено)",
          color: projectColorHex(project?.color),
          seconds,
        };
      })
      .sort((a, b) => b.seconds - a.seconds);
  }, [sessions, projects]);

  const totalByProject = Math.max(1, byProject.reduce((s, x) => s + x.seconds, 0));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Сегодня фокус" value={formatDuration(focusToday)} icon={<Timer size={14} />} />
        <Card
          label="За неделю"
          value={formatDuration(focusWeek)}
          icon={<CalendarDays size={14} />}
        />
        <Card
          label="Сессий сегодня"
          value={todaySessions.length.toString()}
          icon={<Target size={14} />}
        />
        <Card
          label="Закрыто сегодня"
          value={completedToday.toString()}
          icon={<CheckCircle2 size={14} />}
        />
      </div>

      <section className="rounded-lg border border-border bg-bg-soft p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium">Фокус по дням</h3>
          <span className="text-xs text-fg-subtle">последние 7 дней</span>
        </div>
        <div className="flex h-40 items-end gap-3">
          {weekDays.map((d, i) => {
            const h = (d.seconds / maxDay) * 100;
            const isToday = i === weekDays.length - 1;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex h-full w-full items-end">
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all",
                      isToday ? "bg-accent" : "bg-accent/60",
                    )}
                    style={{ height: `${Math.max(h, 2)}%` }}
                  />
                </div>
                <div className="text-[10px] text-fg-subtle">{d.label}</div>
                <div className="text-[10px] font-mono tabular-nums text-fg-muted">
                  {d.seconds > 0 ? formatDuration(d.seconds) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-bg-soft p-4">
        <h3 className="mb-3 text-sm font-medium">Время по проектам</h3>
        {byProject.length === 0 ? (
          <div className="py-6 text-center text-sm text-fg-subtle">
            Пока нет записанных сессий
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {byProject.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="w-40 truncate">{p.name}</span>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(p.seconds / totalByProject) * 100}%`,
                        background: p.color,
                      }}
                    />
                  </div>
                </div>
                <span className="w-16 text-right font-mono tabular-nums text-fg-muted">
                  {formatDuration(p.seconds)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-soft p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-fg-subtle">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

