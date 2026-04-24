import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

/** Resolves once the Zustand persist layer has finished rehydrating from IDB. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    const unsubFinish = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return unsubFinish;
  }, [hydrated]);

  return hydrated;
}
