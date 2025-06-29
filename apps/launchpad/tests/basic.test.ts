import { describe, expect, it } from "vitest";

describe("Launchpad Basic Tests", () => {
  it("should pass a basic test", () => {
    expect(true).toBe(true);
  });

  it("should perform basic arithmetic", () => {
    expect(2 + 2).toBe(4);
    expect(10 - 5).toBe(5);
    expect(3 * 4).toBe(12);
    expect(8 / 2).toBe(4);
  });

  it("should handle string operations", () => {
    expect("hello".toUpperCase()).toBe("HELLO");
    expect("world".length).toBe(5);
    expect("test".includes("es")).toBe(true);
  });
});