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
    expect(sharePageSource).toContain('model.cdp.domSnapshot.state === "available"');
    expect(sharePageSource).toContain("DOM snapshot was redacted before upload");
    expect(sharePageSource).not.toContain('type="radio"');
    expect(sharePageSource).not.toContain('for="tab-issues"');
    expect(sharePageSource).not.toContain('<label for="tab-summary">Overview</label>');
    expect(sharePageSource).not.toContain("<h2>Privacy &amp; Size Changes</h2>");
    expect(sharePageSource).not.toContain("JSON.stringify(snapshot.cdp.domSnapshot ?? null");
    expect(sharePageSource).not.toContain("notice.path");
  });
});
