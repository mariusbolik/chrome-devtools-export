import { describe, expect, test } from "bun:test";
import { shouldSuppressConsoleLog } from "../../src/console-filter";

describe("console log filtering", () => {
  test("suppresses legacy empty debug Error rows", () => {
    expect(shouldSuppressConsoleLog({ type: "debug", text: "Error" })).toBe(true);
    expect(shouldSuppressConsoleLog({ type: "debug", text: "TypeError: " })).toBe(true);
  });

  test("keeps actionable debug errors with stack or callsite context", () => {
    expect(shouldSuppressConsoleLog({ type: "debug", text: "Error\nConsole call stack:\n    at render (https://x.com/home:1:1)" })).toBe(false);
    expect(shouldSuppressConsoleLog({ type: "debug", text: "Error: failed to fetch" })).toBe(false);
    expect(shouldSuppressConsoleLog({ type: "error", text: "Error" })).toBe(false);
  });
});
