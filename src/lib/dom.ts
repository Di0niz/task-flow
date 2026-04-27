/**
 * Safely escape a string for use in a CSS attribute selector.
 * Falls back when CSS.escape is unavailable (older browsers, JSDOM).
 */
export function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}
