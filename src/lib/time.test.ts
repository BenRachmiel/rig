import { describe, it, expect, vi, afterEach } from "vitest";
import { relativeTime } from "./time";

describe("relativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function freeze(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  }

  it("returns 'just now' for times less than a minute ago", () => {
    freeze("2025-01-01T12:00:00Z");
    expect(relativeTime("2025-01-01T11:59:30Z")).toBe("just now");
  });

  it("returns minutes ago", () => {
    freeze("2025-01-01T12:00:00Z");
    expect(relativeTime("2025-01-01T11:55:00Z")).toBe("5 minutes ago");
  });

  it("returns singular minute", () => {
    freeze("2025-01-01T12:00:00Z");
    expect(relativeTime("2025-01-01T11:59:00Z")).toBe("1 minute ago");
  });

  it("returns hours ago", () => {
    freeze("2025-01-01T12:00:00Z");
    expect(relativeTime("2025-01-01T09:00:00Z")).toBe("3 hours ago");
  });

  it("returns singular hour", () => {
    freeze("2025-01-01T12:00:00Z");
    expect(relativeTime("2025-01-01T11:00:00Z")).toBe("1 hour ago");
  });

  it("returns days ago", () => {
    freeze("2025-01-10T12:00:00Z");
    expect(relativeTime("2025-01-07T12:00:00Z")).toBe("3 days ago");
  });

  it("returns future minutes", () => {
    freeze("2025-01-01T12:00:00Z");
    expect(relativeTime("2025-01-01T12:10:00Z")).toBe("in 10 minutes");
  });

  it("returns future hours", () => {
    freeze("2025-01-01T12:00:00Z");
    expect(relativeTime("2025-01-01T14:00:00Z")).toBe("in 2 hours");
  });

  it("returns future days", () => {
    freeze("2025-01-01T12:00:00Z");
    expect(relativeTime("2025-01-04T12:00:00Z")).toBe("in 3 days");
  });

  it("returns singular day", () => {
    freeze("2025-01-01T12:00:00Z");
    expect(relativeTime("2025-01-02T12:00:00Z")).toBe("in 1 day");
  });
});
