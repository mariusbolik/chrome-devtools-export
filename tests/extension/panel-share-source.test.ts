import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const panelHtml = readFileSync(new URL("../../panel.html", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../../src/panel.ts", import.meta.url), "utf8");
const shareSource = readFileSync(new URL("../../src/share-snapshot.ts", import.meta.url), "utf8");

describe("DevTools panel share wiring", () => {
  test("lets DevTools shares include screenshots by default", () => {
    expect(panelHtml).toContain('id="shareIncludeScreenshot"');
    expect(panelSource).toContain("const includeScreenshot = $(\"shareIncludeScreenshot\") as HTMLInputElement");
    expect(panelSource).toContain("includeScreenshot.checked = true");
    expect(panelSource).toContain("includeScreenshot: includeScreenshot.checked");
    expect(shareSource).toContain("captureCdpSnapshot(options.inspectedTabId, { includeScreenshot: options.includeScreenshot })");
  });
});
