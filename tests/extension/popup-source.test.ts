import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const popupHtml = readFileSync(new URL("../../popup.html", import.meta.url), "utf8");
const popupSource = readFileSync(new URL("../../src/popup.ts", import.meta.url), "utf8");
const devtoolsSource = readFileSync(new URL("../../src/devtools.ts", import.meta.url), "utf8");

describe("popup source", () => {
  test("does not show a fake DevTools panel opener", () => {
    expect(popupHtml).not.toContain('id="openExportPanel"');
    expect(popupHtml).not.toContain("Open Export Panel");
    expect(popupHtml).not.toContain('id="devtoolsHint"');
    expect(popupSource).not.toContain("DEVTOOLS_PANEL_HINT");
    expect(popupSource).not.toContain("openExportPanel");
    expect(popupSource).not.toContain("open-export-panel");
    expect(devtoolsSource).not.toContain("open-export-panel");
    expect(devtoolsSource).not.toContain("exportPanel.show()");
  });
});
