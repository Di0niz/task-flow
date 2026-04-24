import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

/**
 * Global keyboard shortcuts.
 * Per-row task hotkeys live on the row itself.
 */
export function useGlobalHotkeys() {
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen);
  const zoomOut = useAppStore((s) => s.zoomOut);
  const zoomStack = useAppStore((s) => s.zoomStack);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Command palette: ⌘K
      if (meta && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Shortcuts overlay: ⌘/
      if (meta && !e.altKey && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(!shortcutsOpen);
        return;
      }

      // Undo / Redo
      if (meta && !e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const temporal = useAppStore.temporal.getState();
        if (e.shiftKey) temporal.redo();
        else temporal.undo();
        return;
      }

      // Zoom out: ⌘⇧,
      if (meta && e.shiftKey && (e.key === "," || e.key === "<")) {
        if (zoomStack.length > 0) {
          e.preventDefault();
          zoomOut();
        }
        return;
      }

      // Focus mode: ⌘⇧F — focus on active row, or clear focus if already on.
      if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
        const state = useAppStore.getState();
        if (state.focusedTaskId) {
          e.preventDefault();
          state.setFocusedTask(null);
          return;
        }
        const focused = document.activeElement as HTMLElement | null;
        const taskId = focused?.closest<HTMLElement>("[data-task-id]")?.dataset.taskId;
        if (taskId) {
          e.preventDefault();
          state.setFocusedTask(taskId);
        }
        return;
      }

      // Timer: Alt+T — stop if running, else start on the focused task row.
      if (e.altKey && !meta && e.key.toLowerCase() === "t") {
        const { activeTimer, startTimer, stopTimer } = useAppStore.getState();
        if (activeTimer) {
          e.preventDefault();
          stopTimer();
          return;
        }
        const focused = document.activeElement as HTMLElement | null;
        const taskId = focused?.closest<HTMLElement>("[data-task-id]")?.dataset.taskId;
        if (taskId) {
          e.preventDefault();
          startTimer(taskId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    setCommandPaletteOpen,
    setShortcutsOpen,
    shortcutsOpen,
    zoomOut,
    zoomStack.length,
  ]);
}
