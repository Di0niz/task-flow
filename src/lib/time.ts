/** `HH:MM:SS` for the floating timer. */
export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Compact duration for task rows.
 * - `< 1s`   → `""`
 * - `< 1m`   → `Xs`
 * - `< 5m`   → `Xmin Ys` (seconds kept while the number is still meaningful)
 * - `< 1h`   → `Xmin`
 * - `< 10h`  → `Xh Ymin` (minutes dropped only if zero)
 * - `≥ 10h`  → `Xh`
 */
export function formatDurationShort(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 1) return "";
  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  if (minutes < 5) {
    return seconds > 0 ? `${minutes}min ${seconds}s` : `${minutes}min`;
  }
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 10 && remMin > 0) return `${hours}h ${remMin}min`;
  return `${hours}h`;
}
