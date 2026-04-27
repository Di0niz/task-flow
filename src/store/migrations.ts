import { extractTags } from "../lib/tags";
import type { Task, TaskId } from "../types";

/**
 * Persisted-shape migrations for the Zustand store.
 *
 * Each migration transforms a partial state from version N into version N+1.
 * Adding a new version: bump `STORE_VERSION`, push a new entry into `MIGRATIONS`.
 */

export const STORE_VERSION = 5;

/** A loose subset of the persisted state. We type-narrow inside each migration. */
type PersistedState = Record<string, unknown>;

type Migration = (state: PersistedState) => PersistedState;

const v1: Migration = (s) => {
  const filter = (s.filter as Record<string, unknown> | undefined) ?? { tag: null, search: "" };
  return { ...s, filter: { ...filter, showCompleted: true } };
};

const v2: Migration = (s) => {
  const tasks = s.tasks as Record<TaskId, Task> | undefined;
  if (!tasks) return s;
  const next: Record<TaskId, Task> = {};
  for (const [tid, t] of Object.entries(tasks) as [TaskId, Task][]) {
    if (!t || typeof t.title !== "string" || !t.title.includes("#")) {
      next[tid] = t;
      continue;
    }
    const { title, tags } = extractTags(t.title);
    const mergedTags = Array.from(new Set([...(t.tags ?? []), ...tags]));
    next[tid] = { ...t, title, tags: mergedTags };
  }
  return { ...s, tasks: next };
};

const v3: Migration = (s) => {
  // Drop pomodoro-era fields entirely; introduce Task.sessions.
  const next: PersistedState = { ...s };
  delete next.sessions;
  delete next.pomodoro;
  delete next.pomodoroSettings;
  const tasks = next.tasks as Record<string, Task & { secondsSpent?: number; estimatePomodoros?: number }> | undefined;
  if (tasks) {
    const nextTasks: Record<TaskId, Task> = {};
    for (const [tid, raw] of Object.entries(tasks)) {
      const { secondsSpent: _s, estimatePomodoros: _e, ...rest } = raw;
      nextTasks[tid as TaskId] = { ...rest, sessions: rest.sessions ?? [] };
    }
    next.tasks = nextTasks;
  }
  return next;
};

const v4: Migration = (s) => {
  // Hide completed by default, so ticking a task actually removes it from view.
  const filter = (s.filter as Record<string, unknown> | undefined) ?? { tag: null, search: "" };
  return { ...s, filter: { ...filter, showCompleted: false } };
};

/** Ordered list of migrations applied in sequence. Index = source version. */
const MIGRATIONS: ReadonlyArray<Migration> = [v1, v2, v3, v4];

/**
 * Apply all migrations needed to bring `persisted` from `fromVersion` up to
 * `toVersion` (defaults to `STORE_VERSION`). Safe to call when `persisted` is
 * `undefined`/`null`.
 */
export function migrate(
  persisted: unknown,
  fromVersion: number,
  toVersion: number = STORE_VERSION,
): PersistedState {
  let state: PersistedState = (persisted as PersistedState) ?? {};
  for (let v = fromVersion; v < toVersion; v++) {
    const step = MIGRATIONS[v];
    if (step) state = step(state);
  }
  return state;
}
