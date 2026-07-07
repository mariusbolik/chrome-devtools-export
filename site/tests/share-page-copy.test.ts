import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const sharePageSource = readFileSync(new URL("../src/pages/share/[id]/index.astro", import.meta.url), "utf8");

describe("share page copy", () => {
  test("uses honest hash-based tabs for a static DevTools export report", () => {
    expect(sharePageSource).toContain('role="tablist"');
    expect(sharePageSource).toContain('href="#triage"');
    expect(sharePageSource).toContain(">Triage</a>");
    expect(sharePageSource).toContain('href="#ai-summary"');
    expect(sharePageSource).toContain(">AI Summary</a>");
    expect(sharePageSource).toContain(">Page Snapshot</a>");
    expect(sharePageSource).toContain(">Console</a>");
    expect(sharePageSource).toContain(">Resources</a>");
    expect(sharePageSource).toContain(">Network</a>");
    expect(sharePageSource).toContain(">Storage</a>");
    expect(sharePageSource).toContain(">Performance Summary</a>");
    expect(sharePageSource).toContain("<h2>What likely failed</h2>");
    expect(sharePageSource).toContain("captureFidelity");
    expect(sharePageSource).toContain("network.rows");
    expect(sharePageSource).toContain("captureNote");
    expect(sharePageSource).toContain("performance.navigationRows");
    expect(sharePageSource).toContain("privacy.summaryRows");
    expect(sharePageSource).toContain("model.aiSummary");
    expect(sharePageSource).toContain('data-copy-target="aiSummaryText"');
    expect(sharePageSource).toContain("request.anchorId");
    expect(sharePageSource).toContain("request.hasHeaders");
    expect(sharePageSource).toContain("request.hasPayload");
    expect(sharePageSource).toContain("request.hasResponse");
    expect(sharePageSource).toContain("section.anchorId");
    expect(sharePageSource).toContain("<pre>{entry.text}</pre>");
    expect(sharePageSource).not.toContain("snapshot.console.find");
    expect(sharePageSource).toContain('model.cdp.domSnapshot.state === "available"');
    expect(sharePageSource).toContain("DOM snapshot was redacted before upload");
    expect(sharePageSource).toContain("model.summaryCards.map");
    expect(sharePageSource).toContain("card.label");
    expect(sharePageSource).toContain("card.value");
    expect(sharePageSource).toContain("card.detail");
    expect(sharePageSource).not.toContain("<span>Network</span>");
    expect(sharePageSource).not.toContain("<span>Console</span>");
    expect(sharePageSource).not.toContain("<span>Client State</span>");
    expect(sharePageSource).not.toContain("<span>Capture</span>");
    expect(sharePageSource).not.toContain("No request body captured");
    expect(sharePageSource).not.toContain("No response body captured");
    expect(sharePageSource).not.toContain("No headers captured for this request");
    expect(sharePageSource).not.toContain('type="radio"');
    expect(sharePageSource).not.toContain('for="tab-issues"');
    expect(sharePageSource).not.toContain('<label for="tab-summary">Overview</label>');
    expect(sharePageSource).not.toContain("<h2>Privacy &amp; Size Changes</h2>");
    expect(sharePageSource).not.toContain("JSON.stringify(snapshot.cdp.domSnapshot ?? null");
    expect(sharePageSource).not.toContain("notice.path");
  });

  test("keeps AI Summary as the last tab", () => {
    const tabNavSource = sharePageSource.match(/<nav class="tabs"[\s\S]*?<\/nav>/)?.[0] ?? "";
    const panelSource = sharePageSource.match(/<div class="panel[\s\S]*?<script is:inline>/)?.[0] ?? "";
    const tabOrder = [...tabNavSource.matchAll(/data-tab="([^"]+)"/g)].map((match) => match[1]);
    const panelOrder = [...panelSource.matchAll(/data-panel="([^"]+)"/g)].map((match) => match[1]);

    expect(tabOrder.at(-1)).toBe("ai-summary");
    expect(panelOrder.at(-1)).toBe("ai-summary");
  });

  test("scrolls hash targets inside the active panel below the sticky header", () => {
    expect(sharePageSource).toContain("scrollTargetIntoPanelView");
    expect(sharePageSource).toContain("targetRect.top - panelRect.top + panel.scrollTop");
    expect(sharePageSource).toContain("panel.scrollTo({");
    expect(sharePageSource).not.toContain('target.scrollIntoView({ block: "start" })');
    expect(sharePageSource).toMatch(/\.app-shell\s*{[\s\S]*height: 100vh;/);
    expect(sharePageSource).toMatch(/\.details\s*{[\s\S]*overflow: hidden;/);
  });

  test("uses right-aligned Heroicons actions for AI summary copy and raw JSON download", () => {
    expect(sharePageSource).toContain('<div class="toolbar toolbar-right">');
    expect(sharePageSource).toContain('data-heroicon="clipboard-document"');
    expect(sharePageSource).toContain('data-heroicon="arrow-down-tray"');
    expect(sharePageSource).toContain("data-action-label");
    expect(sharePageSource).toContain('querySelector("[data-action-label]")');
    expect(sharePageSource).toContain('href={`/api/share/${model.id}.json`}');
    expect(sharePageSource).toContain('download={`devtoolsexport-${model.id}.json`}');
    expect(sharePageSource).toMatch(/\.toolbar-right\s*{[\s\S]*justify-content: flex-end;/);
    expect(sharePageSource).toMatch(/\.heroicon\s*{[\s\S]*width: 14px;/);
  });
});
