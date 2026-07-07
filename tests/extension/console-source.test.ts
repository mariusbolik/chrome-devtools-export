import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const backgroundSource = readFileSync(new URL("../../src/background.ts", import.meta.url), "utf8");
const contentBridgeSource = readFileSync(new URL("../../src/content-bridge.ts", import.meta.url), "utf8");
const contentMainSource = readFileSync(new URL("../../src/content-main.ts", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../../src/panel.ts", import.meta.url), "utf8");

describe("console source wiring", () => {
  test("normalizes captured console text before storing or forwarding logs", () => {
    expect(backgroundSource).toContain('import { normalizeConsoleText } from "./console-format";');
    expect(backgroundSource).toContain("text: normalizeConsoleText(log.text)");
    expect(backgroundSource).toContain('import { shouldSuppressConsoleLog } from "./console-filter";');
    expect(backgroundSource).toContain("if (shouldSuppressConsoleLog(entry)) return;");
  });

  test("captures the page console call stack for empty Error objects", () => {
    expect(contentMainSource).toContain('import { formatConsoleMessageWithCallStack } from "./console-format";');
    expect(contentMainSource).toContain("new Error().stack");
    expect(contentMainSource).toContain("formatConsoleMessageWithCallStack(args, callStack)");
  });

  test("uses a versioned logger marker so old page injections can be replaced", () => {
    expect(contentBridgeSource).toContain('import { DEVTOOLS_EXPORT_LOGGER_VERSION } from "./logger-version";');
    expect(contentBridgeSource).toContain("data-devtools-export-logger-version");
    expect(contentMainSource).toContain("__DEVTOOLS_EXPORT_LOGGER_VERSION__");
    expect(contentMainSource).not.toContain("if ((window as unknown as { __DEVTOOLS_EXPORT_LOGGER__?: boolean }).__DEVTOOLS_EXPORT_LOGGER__) {");
  });

  test("reinjects the content bridge into existing tabs after extension reloads", () => {
    expect(backgroundSource).toContain("reinjectContentBridgeIntoOpenTabs");
    expect(backgroundSource).toContain('files: ["content-bridge.js"]');
    expect(backgroundSource).toContain("chrome.scripting.executeScript");
  });

  test("clears captured logs and panel state when a tab starts navigating", () => {
    expect(backgroundSource).toContain("chrome.tabs.onUpdated.addListener");
    expect(backgroundSource).toContain('changeInfo.status === "loading"');
    expect(backgroundSource).toContain("resetTabCapture(tabId, { notifyPanels: true })");
    expect(backgroundSource).toContain('port.postMessage({ type: "tab-reset" })');
    expect(panelSource).toContain('message.type === "tab-reset"');
    expect(panelSource).toContain("consoleLogs = []");
    expect(panelSource).toContain("networkRequests = []");
  });
});
