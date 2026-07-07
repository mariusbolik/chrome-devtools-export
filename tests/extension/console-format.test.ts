import { describe, expect, test } from "bun:test";
import { formatConsoleMessage, formatConsoleMessageWithCallStack } from "../../src/console-format";

describe("console formatting", () => {
  test("formats empty Error objects without a dangling colon", () => {
    const error = new Error("");
    error.stack = "";

    expect(formatConsoleMessage([error])).toBe("Error");
  });

  test("formats empty Error stacks without a dangling colon", () => {
    const error = new Error("");
    error.stack = "Error: ";
    const typeError = new TypeError("");
    typeError.stack = "TypeError: ";

    expect(formatConsoleMessage([error])).toBe("Error");
    expect(formatConsoleMessage([typeError])).toBe("TypeError");
  });

  test("keeps Error stacks without duplicating the title line", () => {
    const error = new TypeError("failed to fetch");
    error.stack = "TypeError: failed to fetch\n    at fetchUser (app.js:10:5)";

    expect(formatConsoleMessage([error])).toBe("TypeError: failed to fetch\n    at fetchUser (app.js:10:5)");
  });

  test("adds console callsite context for empty Error objects", () => {
    const error = new Error("");
    error.stack = "Error: ";

    expect(
      formatConsoleMessageWithCallStack(
        [error],
        [
          "Error",
          "    at console.debug (chrome-extension://extension-id/content-main.js:1:100)",
          "    at renderTimeline (https://x.com/home:10:5)",
          "    at updateApp (https://x.com/home:20:7)",
        ].join("\n")
      )
    ).toBe("Error\nConsole call stack:\n    at renderTimeline (https://x.com/home:10:5)\n    at updateApp (https://x.com/home:20:7)");
  });

  test("does not add console callsite context when an Error already has a message", () => {
    const error = new Error("failed to render");
    error.stack = "Error: failed to render\n    at renderTimeline (https://x.com/home:10:5)";

    expect(formatConsoleMessageWithCallStack([error], "Error\n    at console.debug (chrome-extension://extension-id/content-main.js:1:100)")).toBe(
      "Error: failed to render\n    at renderTimeline (https://x.com/home:10:5)"
    );
  });
});
