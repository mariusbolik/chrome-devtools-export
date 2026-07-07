import { describe, expect, test } from "bun:test";
import { formatConsoleMessage } from "../../src/console-format";

describe("console formatting", () => {
  test("formats empty Error objects without a dangling colon", () => {
    const error = new Error("");
    error.stack = "";

    expect(formatConsoleMessage([error])).toBe("Error");
  });

  test("keeps Error stacks without duplicating the title line", () => {
    const error = new TypeError("failed to fetch");
    error.stack = "TypeError: failed to fetch\n    at fetchUser (app.js:10:5)";

    expect(formatConsoleMessage([error])).toBe("TypeError: failed to fetch\n    at fetchUser (app.js:10:5)");
  });
});
