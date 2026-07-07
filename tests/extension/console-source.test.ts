import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const backgroundSource = readFileSync(new URL("../../src/background.ts", import.meta.url), "utf8");

describe("console source wiring", () => {
  test("normalizes captured console text before storing or forwarding logs", () => {
    expect(backgroundSource).toContain('import { normalizeConsoleText } from "./console-format";');
    expect(backgroundSource).toContain("text: normalizeConsoleText(log.text)");
  });
});
