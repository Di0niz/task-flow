import { describe, it, expect } from "vitest";
import { extractTags } from "./tags";

describe("extractTags", () => {
  it("returns input unchanged when no tags", () => {
    expect(extractTags("hello world")).toEqual({ title: "hello world", tags: [] });
  });

  it("extracts simple tags", () => {
    expect(extractTags("fix bug #urgent #backend")).toEqual({
      title: "fix bug",
      tags: ["urgent", "backend"],
    });
  });

  it("supports cyrillic tags", () => {
    expect(extractTags("задача #срочно #бэкенд")).toEqual({
      title: "задача",
      tags: ["срочно", "бэкенд"],
    });
  });

  it("does not capture mid-word #", () => {
    expect(extractTags("issue#123")).toEqual({ title: "issue#123", tags: [] });
  });

  it("collapses whitespace left by stripped tags", () => {
    expect(extractTags("a  #x  b")).toEqual({ title: "a b", tags: ["x"] });
  });
});
