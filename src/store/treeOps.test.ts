import { describe, it, expect } from "vitest";
import {
  collectDescendants,
  finalizeTimer,
  getContainer,
  insertAt,
  newTask,
  readContainer,
  removeFromArray,
  scopeKey,
  INBOX_SCOPE,
} from "./treeOps";
import { asProjectId, asTaskId, type Task, type TaskId } from "../types";

describe("insertAt / removeFromArray", () => {
  it("inserts at given index", () => {
    expect(insertAt([1, 2, 3], 1, 9)).toEqual([1, 9, 2, 3]);
  });
  it("clamps index to bounds", () => {
    expect(insertAt([1, 2], -5, 9)).toEqual([9, 1, 2]);
    expect(insertAt([1, 2], 100, 9)).toEqual([1, 2, 9]);
  });
  it("removes first match, returns same ref when missing", () => {
    const arr = [1, 2, 3];
    expect(removeFromArray(arr, 2)).toEqual([1, 3]);
    expect(removeFromArray(arr, 99)).toBe(arr);
  });
});

describe("scopeKey", () => {
  it("returns inbox sentinel for null", () => {
    expect(scopeKey(null)).toBe(INBOX_SCOPE);
  });
  it("returns the projectId otherwise", () => {
    const pid = asProjectId("p1");
    expect(scopeKey(pid)).toBe(pid);
  });
});

describe("newTask", () => {
  it("produces a complete task with sane defaults", () => {
    const t = newTask({ title: "x", projectId: null });
    expect(t.title).toBe("x");
    expect(t.completed).toBe(false);
    expect(t.tags).toEqual([]);
    expect(t.childrenIds).toEqual([]);
    expect(t.sessions).toEqual([]);
    expect(t.parentId).toBeNull();
    expect(typeof t.id).toBe("string");
    expect(t.id.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Tree-traversal fixtures                                                    */
/* -------------------------------------------------------------------------- */

function build(): {
  tasks: Record<TaskId, Task>;
  rootId: TaskId;
  childAId: TaskId;
  childBId: TaskId;
  grandchildId: TaskId;
} {
  const root = newTask({ title: "root", projectId: null });
  const a = newTask({ title: "A", projectId: null, parentId: root.id });
  const b = newTask({ title: "B", projectId: null, parentId: root.id });
  const aa = newTask({ title: "A.1", projectId: null, parentId: a.id });
  root.childrenIds = [a.id, b.id];
  a.childrenIds = [aa.id];
  return {
    tasks: { [root.id]: root, [a.id]: a, [b.id]: b, [aa.id]: aa },
    rootId: root.id,
    childAId: a.id,
    childBId: b.id,
    grandchildId: aa.id,
  };
}

describe("collectDescendants", () => {
  it("returns all descendant ids, excluding the root", () => {
    const f = build();
    const desc = collectDescendants(f.tasks, f.rootId);
    expect(desc.sort()).toEqual([f.childAId, f.childBId, f.grandchildId].sort());
  });
  it("returns empty array for missing root", () => {
    expect(collectDescendants({}, asTaskId("nope"))).toEqual([]);
  });
});

describe("getContainer / readContainer", () => {
  it("identifies parent container for nested tasks", () => {
    const f = build();
    expect(getContainer(f.tasks, f.childAId)).toEqual({
      kind: "parent",
      parentId: f.rootId,
    });
  });
  it("identifies root scope for top-level tasks", () => {
    const f = build();
    expect(getContainer(f.tasks, f.rootId)).toEqual({
      kind: "root",
      scope: INBOX_SCOPE,
    });
  });
  it("readContainer returns the parent's children list", () => {
    const f = build();
    const list = readContainer(f.tasks, {}, f.childAId);
    expect(list).toEqual([f.childAId, f.childBId]);
  });
  it("readContainer returns the scope roots when at top level", () => {
    const f = build();
    const roots: Record<string, TaskId[]> = { [INBOX_SCOPE]: [f.rootId] };
    expect(readContainer(f.tasks, roots, f.rootId)).toEqual([f.rootId]);
  });
});

describe("finalizeTimer", () => {
  it("no-ops when no active timer", () => {
    const f = build();
    expect(finalizeTimer(f.tasks, null, Date.now())).toEqual({
      tasks: f.tasks,
      activeTimer: null,
    });
  });
  it("appends a session and clears the timer", () => {
    const f = build();
    const startedAt = 1_000_000_000_000;
    const endedAt = startedAt + 60_000;
    const result = finalizeTimer(
      f.tasks,
      { taskId: f.childAId, startedAt },
      endedAt,
    );
    expect(result.activeTimer).toBeNull();
    const sessions = result.tasks[f.childAId].sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationMs).toBe(60_000);
    expect(sessions[0].startedAt).toBe(startedAt);
    expect(sessions[0].endedAt).toBe(endedAt);
  });
  it("does not append zero-duration sessions", () => {
    const f = build();
    const ts = 1_000_000_000_000;
    const result = finalizeTimer(f.tasks, { taskId: f.childAId, startedAt: ts }, ts);
    expect(result.activeTimer).toBeNull();
    expect(result.tasks[f.childAId].sessions).toEqual([]);
  });
});
