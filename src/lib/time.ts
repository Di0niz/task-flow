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

/**
 * Human-friendly relative time, Russian. `5 мин назад`, `2 ч назад`, then date.
 */
export function formatRelative(ts: number, now: number = Date.now()): string {
  const delta = now - ts;
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн назад`;
  return new Date(ts).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Parse a user-entered duration string into milliseconds.
 * Supports:
 *   - `45s`, `30sec`
 *   - `15m`, `15min`, `15мин`
 *   - `2h`, `1.5h`, `2ч`
 *   - `1h 30m`, `1h30m`, `1ч 30мин`
 *   - `1:30` → 1h 30min; `1:30:15` → 1h 30min 15s
 *   - bare number → minutes (`90` → 90 min)
 * Returns `null` on empty/invalid input or a negative/zero result.
 */
export function parseDurationInput(raw: string): number | null {
  const input = raw.trim().toLowerCase();
  if (!input) return null;

  // Colon form: H:MM or H:MM:SS
  const colon = input.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (colon) {
    const h = Number(colon[1]);
    const m = Number(colon[2]);
    const s = colon[3] ? Number(colon[3]) : 0;
    const ms = ((h * 60 + m) * 60 + s) * 1000;
    return ms > 0 ? ms : null;
  }

  // Bare number → minutes
  if (/^\d+(\.\d+)?$/.test(input)) {
    const ms = Math.round(parseFloat(input) * 60_000);
    return ms > 0 ? ms : null;
  }

  // Unit form: sequence of `<number><unit>` tokens. Units:
  //   h / ч   — hours
  //   m / min / мин — minutes
  //   s / sec / с   — seconds
  // Word boundaries (`\b`) misbehave around Cyrillic and adjacent digits, so we
  // anchor with a lookahead that allows EOS, whitespace, or another digit.
  const unitRe = /(\d+(?:\.\d+)?)\s*(min|мин|sec|h|ч|m|с|s)(?=\s|\d|$)/g;
  const tokens = input.match(unitRe);
  if (!tokens) return null;

  // Reject if there's leftover non-whitespace content we didn't consume.
  const strippedLen = input.replace(/\s+/g, "").length;
  const consumedNoSpace = tokens.reduce(
    (acc, t) => acc + t.replace(/\s+/g, "").length,
    0,
  );
  if (consumedNoSpace !== strippedLen) return null;

  let totalMs = 0;
  for (const token of tokens) {
    const m = token.match(/(\d+(?:\.\d+)?)\s*(min|мин|sec|h|ч|m|с|s)/)!;
    const value = parseFloat(m[1]);
    const unit = m[2];
    if (unit === "h" || unit === "ч") totalMs += value * 3_600_000;
    else if (unit === "s" || unit === "sec" || unit === "с") totalMs += value * 1_000;
    else totalMs += value * 60_000; // m, min, мин
  }
  const rounded = Math.round(totalMs);
  return rounded > 0 ? rounded : null;
}
