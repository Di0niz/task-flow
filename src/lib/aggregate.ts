import type { ActiveTimer, Task, TaskId } from "../types";

/**
 * Total tracked milliseconds for a task — own completed sessions plus any
 * currently-running sub-session, recursively summed over all descendants.
 */
export function totalTaskMs(
  taskId: TaskId,
  tasks: Record<TaskId, Task>,
  activeTimer: ActiveTimer | null,
  now: number,
): number {
  const task = tasks[taskId];
  if (!task) return 0;

  let own = 0;
  for (const s of task.sessions) own += s.durationMs;
  if (activeTimer && activeTimer.taskId === taskId) {
    own += Math.max(0, now - activeTimer.startedAt);
  }

  let childrenTotal = 0;
  for (const cid of task.childrenIds) {
    childrenTotal += totalTaskMs(cid, tasks, activeTimer, now);
  }

  return own + childrenTotal;
}

/** True if `needleId` equals `rootId` or lives anywhere under it. */
export function isInSubtree(
  rootId: TaskId,
  needleId: TaskId,
  tasks: Record<TaskId, Task>,
): boolean {
  if (rootId === needleId) return true;
  const stack = [...(tasks[rootId]?.childrenIds ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === needleId) return true;
    const t = tasks[id];
    if (t) stack.push(...t.childrenIds);
  }
  return false;
}
