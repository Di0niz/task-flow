import { Sidebar } from "./components/Sidebar";
import { TaskView } from "./components/TaskView";
import { Inspector } from "./components/Inspector";
import { FloatingTimer } from "./components/FloatingTimer";
import { CommandPalette } from "./components/CommandPalette";
import { Confetti } from "./components/Confetti";
import { ShortcutsOverlay } from "./components/ShortcutsOverlay";
import { useTheme } from "./hooks/useTheme";
import { useGlobalHotkeys } from "./hooks/useGlobalHotkeys";
import { useHydrated } from "./hooks/useHydrated";

export default function App() {
  useTheme();
  useGlobalHotkeys();
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg text-sm text-fg-muted">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg text-fg">
      <Sidebar />
      <TaskView />
      <Inspector />
      <CommandPalette />
      <ShortcutsOverlay />
      <FloatingTimer />
      <Confetti />
    </div>
  );
}
