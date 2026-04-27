declare const TaskIdBrand: unique symbol;
declare const ProjectIdBrand: unique symbol;

/**
 * Branded ids — opaque to TypeScript, structurally still strings at runtime.
 * Use the `asTaskId` / `asProjectId` factories at trust boundaries (nanoid,
 * DOM dataset, dnd-kit) instead of bare `as` casts.
 */
export type TaskId = string & { readonly [TaskIdBrand]: never };
export type ProjectId = string & { readonly [ProjectIdBrand]: never };

export const asTaskId = (raw: string): TaskId => raw as TaskId;
export const asProjectId = (raw: string): ProjectId => raw as ProjectId;

export interface TimerSession {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

export interface Task {
  id: TaskId;
  title: string;
  notes?: string;
  completed: boolean;
  completedAt?: number;
  projectId: ProjectId | null; // null = Inbox
  parentId: TaskId | null;
  childrenIds: TaskId[];
  tags: string[];
  collapsed: boolean;
  sessions: TimerSession[];
  dueDate?: string; // ISO yyyy-mm-dd
  /** Date (YYYY-MM-DD) the user flagged the task for Today. Shown in "Сегодня" when equal to current date. */
  todayDate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: ProjectId;
  name: string;
  /** Tailwind class token reference — see PROJECT_COLORS. */
  color: string;
  icon?: string;
  archived: boolean;
  createdAt: number;
}

export interface ActiveTimer {
  taskId: TaskId;
  startedAt: number;
}

export type ViewKey =
  | { kind: "smart"; id: "today" | "inbox" | "upcoming" | "anytime" | "logbook" | "stats" }
  | { kind: "project"; id: ProjectId };

export interface FilterState {
  tag: string | null;
  search: string;
  showCompleted: boolean;
}

export type Theme = "light" | "dark" | "system";

export const PROJECT_COLORS = [
  { name: "indigo", hex: "#6366f1" },
  { name: "blue", hex: "#3b82f6" },
  { name: "cyan", hex: "#06b6d4" },
  { name: "emerald", hex: "#10b981" },
  { name: "lime", hex: "#84cc16" },
  { name: "amber", hex: "#f59e0b" },
  { name: "orange", hex: "#f97316" },
  { name: "rose", hex: "#f43f5e" },
  { name: "pink", hex: "#ec4899" },
  { name: "violet", hex: "#8b5cf6" },
  { name: "slate", hex: "#64748b" },
] as const;

export type ProjectColorName = (typeof PROJECT_COLORS)[number]["name"];

const DEFAULT_COLOR_HEX = "#6366f1";
const COLOR_HEX_BY_NAME: Record<string, string> = Object.fromEntries(
  PROJECT_COLORS.map((c) => [c.name, c.hex]),
);

/** Resolve a Project.color token to a hex string, with a sane fallback. */
export function projectColorHex(color: string | undefined | null): string {
  if (!color) return DEFAULT_COLOR_HEX;
  return COLOR_HEX_BY_NAME[color] ?? DEFAULT_COLOR_HEX;
}
