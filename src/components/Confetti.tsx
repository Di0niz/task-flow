import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { useAppStore } from "../store/useAppStore";
import { cssEscape } from "../lib/dom";

const PALETTE = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#84cc16", // lime
  "#f59e0b", // amber
  "#f97316", // orange
  "#ec4899", // pink
  "#f43f5e", // rose
  "#06b6d4", // cyan
  "#3b82f6", // blue
];

const SHAPES = ["circle", "square"] as const;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

function pickColors(): string[] {
  const count = randInt(3, 5);
  const pool = [...PALETTE].sort(() => Math.random() - 0.5);
  return pool.slice(0, count);
}

function pickShapes() {
  // 50% mixed, 25% circle-only, 25% square-only.
  const roll = Math.random();
  if (roll < 0.25) return ["circle"] as const;
  if (roll < 0.5) return ["square"] as const;
  return SHAPES;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Fires a short confetti burst whenever a task is toggled to completed.
 * Origin is the task's DOM row when we can find it — otherwise the viewport
 * center. Respects `prefers-reduced-motion`.
 */
export function Confetti() {
  const lastCompletion = useAppStore((s) => s.lastCompletion);
  const clearLastCompletion = useAppStore((s) => s.clearLastCompletion);
  const firedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!lastCompletion) return;
    if (firedRef.current === lastCompletion.at) return;
    firedRef.current = lastCompletion.at;

    // Always clear the transient flag — we don't use it for UI anymore.
    const clearT = window.setTimeout(clearLastCompletion, 0);

    if (prefersReducedMotion()) {
      return () => window.clearTimeout(clearT);
    }

    const origin = findOrigin(lastCompletion.taskId);
    const colors = pickColors();
    const shapes = pickShapes();

    // Two small asymmetric bursts — feels richer than one big pop.
    // All knobs are randomized within tight ranges so every firing looks a
    // little different while staying visually coherent.
    confetti({
      particleCount: randInt(14, 22),
      spread: randInt(45, 75),
      startVelocity: rand(18, 26),
      angle: randInt(80, 100),
      ticks: randInt(70, 110),
      scalar: rand(0.45, 0.65),
      gravity: rand(1.0, 1.3),
      drift: rand(-0.4, 0.4),
      origin,
      colors,
      shapes: [...shapes],
      disableForReducedMotion: true,
    });
    const delay = randInt(70, 140);
    window.setTimeout(() => {
      confetti({
        particleCount: randInt(8, 14),
        spread: randInt(70, 110),
        startVelocity: rand(12, 20),
        angle: randInt(70, 110),
        ticks: randInt(55, 85),
        scalar: rand(0.4, 0.55),
        gravity: rand(1.1, 1.4),
        drift: rand(-0.6, 0.6),
        origin,
        colors,
        shapes: [...shapes],
        disableForReducedMotion: true,
      });
    }, delay);

    return () => window.clearTimeout(clearT);
  }, [lastCompletion, clearLastCompletion]);

  return null;
}

function findOrigin(taskId: string): { x: number; y: number } {
  if (typeof document === "undefined") return { x: 0.5, y: 0.6 };
  const el = document.querySelector<HTMLElement>(`[data-task-id="${cssEscape(taskId)}"]`);
  if (!el) return { x: 0.5, y: 0.6 };
  const rect = el.getBoundingClientRect();
  const x = (rect.left + rect.right) / 2 / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}

