import { describe, it, expect } from "vitest";
import { formatDurationShort, formatMs, formatRelative, parseDurationInput } from "./time";

describe("formatMs", () => {
  it("zero pad HH:MM:SS", () => {
    expect(formatMs(0)).toBe("00:00:00");
    expect(formatMs(1000)).toBe("00:00:01");
    expect(formatMs(60_000)).toBe("00:01:00");
    expect(formatMs(3_661_000)).toBe("01:01:01");
  });
  it("clamps negative", () => {
    expect(formatMs(-100)).toBe("00:00:00");
  });
});

describe("formatDurationShort", () => {
  it("renders compactly across thresholds", () => {
    expect(formatDurationShort(0)).toBe("");
    expect(formatDurationShort(15_000)).toBe("15s");
    expect(formatDurationShort(60_000)).toBe("1min");
    expect(formatDurationShort(75_000)).toBe("1min 15s");
    expect(formatDurationShort(60 * 60 * 1000)).toBe("1h");
    expect(formatDurationShort(90 * 60 * 1000)).toBe("1h 30min");
    expect(formatDurationShort(11 * 60 * 60 * 1000)).toBe("11h");
  });
});

describe("parseDurationInput", () => {
  it("returns null for empty/invalid", () => {
    expect(parseDurationInput("")).toBeNull();
    expect(parseDurationInput("   ")).toBeNull();
    expect(parseDurationInput("hello")).toBeNull();
    expect(parseDurationInput("1x")).toBeNull();
    expect(parseDurationInput("0")).toBeNull();
  });

  it("treats bare numbers as minutes", () => {
    expect(parseDurationInput("90")).toBe(90 * 60_000);
    expect(parseDurationInput("1.5")).toBe(Math.round(1.5 * 60_000));
  });

  it("parses single units", () => {
    expect(parseDurationInput("45s")).toBe(45_000);
    expect(parseDurationInput("15m")).toBe(15 * 60_000);
    expect(parseDurationInput("15min")).toBe(15 * 60_000);
    expect(parseDurationInput("15мин")).toBe(15 * 60_000);
    expect(parseDurationInput("2h")).toBe(2 * 3_600_000);
    expect(parseDurationInput("2ч")).toBe(2 * 3_600_000);
  });

  it("parses compound expressions", () => {
    expect(parseDurationInput("1h 30m")).toBe(90 * 60_000);
    expect(parseDurationInput("1h30m")).toBe(90 * 60_000);
    expect(parseDurationInput("1ч 30мин")).toBe(90 * 60_000);
  });

  it("parses colon forms", () => {
    expect(parseDurationInput("1:30")).toBe(90 * 60_000);
    expect(parseDurationInput("0:45")).toBe(45 * 60_000);
    expect(parseDurationInput("1:30:15")).toBe(90 * 60_000 + 15_000);
  });

  it("rejects garbage between unit tokens", () => {
    expect(parseDurationInput("1h junk 30m")).toBeNull();
  });
});

describe("formatRelative", () => {
  const NOW = 1_700_000_000_000; // arbitrary fixed reference
  it("under a minute", () => {
    expect(formatRelative(NOW - 30_000, NOW)).toBe("только что");
  });
  it("minutes", () => {
    expect(formatRelative(NOW - 5 * 60_000, NOW)).toBe("5 мин назад");
  });
  it("hours", () => {
    expect(formatRelative(NOW - 3 * 3_600_000, NOW)).toBe("3 ч назад");
  });
  it("days", () => {
    expect(formatRelative(NOW - 2 * 86_400_000, NOW)).toBe("2 дн назад");
  });
});
