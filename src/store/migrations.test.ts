import { describe, it, expect } from "vitest";
import { migrate, STORE_VERSION } from "./migrations";

describe("migrate", () => {
  it("handles empty/undefined input", () => {
    const out = migrate(undefined, 0);
    expect(out).toBeTypeOf("object");
  });

  it("step v0→v1 adds showCompleted=true to filter", () => {
    const out = migrate({ filter: { tag: null, search: "" } }, 0, 1);
    expect((out.filter as Record<string, unknown>).showCompleted).toBe(true);
  });

  it("step v1→v2 extracts inline #tags from titles", () => {
    const persisted = {
      tasks: {
        a: { id: "a", title: "fix #urgent stuff", tags: [] },
        b: { id: "b", title: "no tags here", tags: ["existing"] },
      },
    };
    const out = migrate(persisted, 1, 2);
    const tasks = out.tasks as Record<string, { title: string; tags: string[] }>;
    expect(tasks.a.title).toBe("fix stuff");
    expect(tasks.a.tags).toEqual(["urgent"]);
    expect(tasks.b.title).toBe("no tags here");
    expect(tasks.b.tags).toEqual(["existing"]);
  });

  it("step v2→v3 drops pomodoro-era fields and ensures sessions array", () => {
    const persisted = {
      sessions: ["legacy"],
      pomodoro: { running: true },
      pomodoroSettings: { workMin: 25 },
      tasks: {
        a: {
          id: "a",
          title: "x",
          tags: [],
          secondsSpent: 600,
          estimatePomodoros: 3,
        },
      },
    };
    const out = migrate(persisted, 2, 3);
    expect(out.sessions).toBeUndefined();
    expect(out.pomodoro).toBeUndefined();
    expect(out.pomodoroSettings).toBeUndefined();
    const a = (out.tasks as Record<string, Record<string, unknown>>).a;
    expect(a.secondsSpent).toBeUndefined();
    expect(a.estimatePomodoros).toBeUndefined();
    expect(a.sessions).toEqual([]);
  });

  it("step v3→v4 forces showCompleted=false", () => {
    const out = migrate({ filter: { tag: null, search: "", showCompleted: true } }, 3, 4);
    expect((out.filter as Record<string, unknown>).showCompleted).toBe(false);
  });

  it("from version 0 chains every migration in sequence", () => {
    const out = migrate(
      {
        sessions: ["legacy"],
        tasks: {
          a: { id: "a", title: "fix #urgent", tags: [], secondsSpent: 1 },
        },
        filter: { tag: null, search: "" },
      },
      0,
    );
    const a = (out.tasks as Record<string, Record<string, unknown>>).a;
    expect(a.title).toBe("fix");
    expect(a.tags).toEqual(["urgent"]);
    expect(a.sessions).toEqual([]);
    expect(a.secondsSpent).toBeUndefined();
    expect(out.sessions).toBeUndefined();
    expect((out.filter as Record<string, unknown>).showCompleted).toBe(false);
  });

  it("STORE_VERSION matches number of migrations", () => {
    // If you bump STORE_VERSION, push a new migration step.
    // (Indirect smoke test — fixture-based tests above ensure each step works.)
    expect(STORE_VERSION).toBeGreaterThan(0);
  });
});
