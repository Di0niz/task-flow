import { useAppStore } from "../store/useAppStore";
import { asTaskId } from "../types";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type Mod = "mod" | "shift" | "alt";

export interface KeySpec {
  /** A single key string (lower-cased) — e.g. "k", ",", "/", "arrowup". */
  key: string;
  /** Modifiers that must be held simultaneously. `mod` = Cmd on macOS / Ctrl on others. */
  mods?: ReadonlyArray<Mod>;
}

export interface Hotkey {
  /** Stable id, used as React key in the overlay. */
  id: string;
  /** Visual binding string, e.g. "⌘K". */
  label: string;
  /** Human description, shown in the overlay. */
  description: string;
  /** Group heading in the overlay. */
  group: "Навигация" | "Редактирование" | "История" | "Таймер";
  /** Whether this is a global shortcut handled by `useGlobalHotkeys`. */
  scope: "global" | "row";
  /** Match expression(s) — multiple specs let one hotkey accept aliases (e.g. "<" and ","). */
  keys?: ReadonlyArray<KeySpec>;
  /** Handler invoked when the hotkey fires. Reads state via getState() at call time. */
  run?: (e: KeyboardEvent) => void;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function matches(e: KeyboardEvent, spec: KeySpec): boolean {
  const wantMod = spec.mods?.includes("mod") ?? false;
  const wantShift = spec.mods?.includes("shift") ?? false;
  const wantAlt = spec.mods?.includes("alt") ?? false;

  const haveMod = e.metaKey || e.ctrlKey;
  if (wantMod !== haveMod) return false;
  if (wantShift !== e.shiftKey) return false;
  if (wantAlt !== e.altKey) return false;

  return e.key.toLowerCase() === spec.key.toLowerCase();
}

export function eventMatchesAny(e: KeyboardEvent, specs: ReadonlyArray<KeySpec>): boolean {
  return specs.some((s) => matches(e, s));
}

function activeRowTaskId(): string | null {
  const focused = document.activeElement as HTMLElement | null;
  return focused?.closest<HTMLElement>("[data-task-id]")?.dataset.taskId ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Source of truth                                                            */
/* -------------------------------------------------------------------------- */

export const HOTKEYS: ReadonlyArray<Hotkey> = [
  // ── Навигация ──────────────────────────────────────────────────────────
  {
    id: "command-palette",
    label: "⌘K",
    description: "Палитра команд",
    group: "Навигация",
    scope: "global",
    keys: [{ key: "k", mods: ["mod"] }],
    run: () => useAppStore.getState().setCommandPaletteOpen(true),
  },
  {
    id: "shortcuts-overlay",
    label: "⌘/",
    description: "Эта шпаргалка",
    group: "Навигация",
    scope: "global",
    keys: [{ key: "/", mods: ["mod"] }, { key: "/", mods: ["mod", "shift"] }],
    run: () => {
      const s = useAppStore.getState();
      s.setShortcutsOpen(!s.shortcutsOpen);
    },
  },
  {
    id: "zoom-out",
    label: "⌘⇧,",
    description: "Zoom out",
    group: "Навигация",
    scope: "global",
    keys: [
      { key: ",", mods: ["mod", "shift"] },
      { key: "<", mods: ["mod", "shift"] },
    ],
    run: () => {
      const s = useAppStore.getState();
      if (s.zoomStack.length > 0) s.zoomOut();
    },
  },
  {
    id: "focus-mode",
    label: "⌘⇧F",
    description: "Режим фокуса для задачи",
    group: "Навигация",
    scope: "global",
    keys: [{ key: "f", mods: ["mod", "shift"] }],
    run: () => {
      const s = useAppStore.getState();
      if (s.focusedTaskId) {
        s.setFocusedTask(null);
        return;
      }
      const taskId = activeRowTaskId();
      if (taskId) s.setFocusedTask(asTaskId(taskId));
    },
  },
  {
    id: "zoom-in",
    label: "⌘⇧.",
    description: "Zoom in",
    group: "Навигация",
    scope: "row",
  },
  {
    id: "row-prev",
    label: "↑ (в начале строки)",
    description: "Фокус в предыдущую задачу",
    group: "Навигация",
    scope: "row",
  },
  {
    id: "row-next",
    label: "↓ (в конце строки)",
    description: "Фокус в следующую задачу",
    group: "Навигация",
    scope: "row",
  },

  // ── Редактирование ─────────────────────────────────────────────────────
  { id: "row-add-below", label: "Enter", description: "Новая задача ниже", group: "Редактирование", scope: "row" },
  { id: "row-newline", label: "Shift+Enter", description: "Перенос строки в задаче", group: "Редактирование", scope: "row" },
  { id: "row-toggle-done", label: "⌘↩", description: "Отметить выполненной / снять", group: "Редактирование", scope: "row" },
  { id: "row-indent", label: "Tab / Shift+Tab", description: "Отступ / обратный отступ", group: "Редактирование", scope: "row" },
  { id: "row-merge-up", label: "Backspace (в начале)", description: "Слить с предыдущей задачей", group: "Редактирование", scope: "row" },
  { id: "row-delete-empty", label: "Backspace (пустая)", description: "Удалить задачу", group: "Редактирование", scope: "row" },
  { id: "row-duplicate", label: "⌘D", description: "Дублировать задачу", group: "Редактирование", scope: "row" },
  { id: "row-move", label: "⌘⇧↑ / ⌘⇧↓", description: "Переместить задачу", group: "Редактирование", scope: "row" },
  { id: "row-collapse", label: "⌘⇧→ / ⌘⇧←", description: "Раскрыть / свернуть", group: "Редактирование", scope: "row" },
  { id: "row-blur", label: "Escape", description: "Снять фокус", group: "Редактирование", scope: "row" },

  // ── История ────────────────────────────────────────────────────────────
  {
    id: "undo",
    label: "⌘Z",
    description: "Отменить",
    group: "История",
    scope: "global",
    keys: [{ key: "z", mods: ["mod"] }],
    run: () => useAppStore.temporal.getState().undo(),
  },
  {
    id: "redo",
    label: "⌘⇧Z",
    description: "Повторить",
    group: "История",
    scope: "global",
    keys: [{ key: "z", mods: ["mod", "shift"] }],
    run: () => useAppStore.temporal.getState().redo(),
  },

  // ── Таймер ─────────────────────────────────────────────────────────────
  {
    id: "timer-toggle",
    label: "⌥T",
    description: "Старт / стоп для задачи в фокусе",
    group: "Таймер",
    scope: "global",
    keys: [{ key: "t", mods: ["alt"] }],
    run: () => {
      const s = useAppStore.getState();
      if (s.activeTimer) {
        s.stopTimer();
        return;
      }
      const taskId = activeRowTaskId();
      if (taskId) s.startTimer(asTaskId(taskId));
    },
  },
];

/** All globally-handled hotkeys, indexed by `useGlobalHotkeys`. */
export const GLOBAL_HOTKEYS: ReadonlyArray<Hotkey> = HOTKEYS.filter((h) => h.scope === "global");

/** Grouped view used by `<ShortcutsOverlay>`. */
export function groupedHotkeys(): ReadonlyArray<{ heading: string; rows: Hotkey[] }> {
  const order = ["Навигация", "Редактирование", "История", "Таймер"] as const;
  return order.map((heading) => ({
    heading,
    rows: HOTKEYS.filter((h) => h.group === heading),
  }));
}
