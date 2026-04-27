import { useEffect } from "react";
import { GLOBAL_HOTKEYS, eventMatchesAny } from "../lib/hotkeys";

/**
 * Global keyboard shortcuts. Subscribes once per mount and reads state via
 * `useAppStore.getState()` inside handlers — no stale-closure pitfalls.
 *
 * Per-row task hotkeys (Enter/Tab/Backspace/etc.) live on the row itself; only
 * shortcuts marked `scope: "global"` are wired here.
 */
export function useGlobalHotkeys() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const hotkey of GLOBAL_HOTKEYS) {
        if (!hotkey.keys || !hotkey.run) continue;
        if (!eventMatchesAny(e, hotkey.keys)) continue;
        e.preventDefault();
        hotkey.run(e);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
