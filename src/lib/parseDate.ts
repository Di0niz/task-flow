import { ru, en } from "chrono-node";

const chronoRu = ru.casual.clone();
const chronoEn = en.casual.clone();

export interface ParsedTitle {
  title: string;
  dueDate?: string; // YYYY-MM-DD
}

function toIso(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

/**
 * Parse a free-form title and extract a due date using chrono-node (ru + en).
 * Returns the title with the date phrase stripped, plus the ISO date (YYYY-MM-DD).
 * If no date is found, returns the original title and no date.
 */
export function parseTitleWithDate(raw: string): ParsedTitle {
  const ref = new Date();

  const ruHits = chronoRu.parse(raw, ref, { forwardDate: true });
  const enHits = chronoEn.parse(raw, ref, { forwardDate: true });
  const hit =
    ruHits[0] ?? enHits[0] ?? null;

  if (!hit) return { title: raw };

  const date = hit.start.date();
  if (!date || isNaN(date.getTime())) return { title: raw };

  const start = hit.index;
  const end = hit.index + hit.text.length;
  const stripped = (raw.slice(0, start) + raw.slice(end))
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    title: stripped || raw,
    dueDate: toIso(date),
  };
}
