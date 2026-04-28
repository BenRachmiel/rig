import { describe, it, expect } from "vitest";
import { isValidYear } from "./track-table";

describe("isValidYear", () => {
  it("accepts empty string", () => {
    expect(isValidYear("")).toBe(true);
  });

  it("accepts 4-digit years", () => {
    expect(isValidYear("2024")).toBe(true);
    expect(isValidYear("1999")).toBe(true);
    expect(isValidYear("0001")).toBe(true);
  });

  it("rejects non-4-digit strings", () => {
    expect(isValidYear("202")).toBe(false);
    expect(isValidYear("20245")).toBe(false);
    expect(isValidYear("abcd")).toBe(false);
    expect(isValidYear("20.4")).toBe(false);
  });

  it("rejects strings with leading/trailing spaces", () => {
    expect(isValidYear(" 2024")).toBe(false);
    expect(isValidYear("2024 ")).toBe(false);
  });
});
