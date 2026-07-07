import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const popupHtml = readFileSync(new URL("../../popup.html", import.meta.url), "utf8");
const popupSource = readFileSync(new URL("../../src/popup.ts", import.meta.url), "utf8");

describe("popup source", () => {
  test("offers a practical path to the DevTools Export panel", () => {
    expect(popupHtml).toContain('id="openExportPanel"');
    expect(popupHtml).toContain("Open Export Panel");
    expect(popupHtml).toContain('id="devtoolsHint"');
    expect(popupSource).toContain("DEVTOOLS_PANEL_HINT");
    expect(popupSource).toContain("openExportPanel.addEventListener");
    expect(popupSource).toContain("Cmd+Option+I");
    expect(popupSource).toContain("Ctrl+Shift+I");
  });
});
