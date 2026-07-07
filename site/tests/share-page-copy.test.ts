import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const sharePageSource = readFileSync(new URL("../src/pages/share/[id]/index.astro", import.meta.url), "utf8");

describe("share page copy", () => {
  test("uses clear overview labels for the first share tab", () => {
    expect(sharePageSource).toContain('<label for="tab-summary">Overview</label>');
    expect(sharePageSource).toContain("<span>Storage Areas</span>");
    expect(sharePageSource).toContain("<em>areas</em>");
    expect(sharePageSource).toContain("<span>Redacted Fields</span>");
    expect(sharePageSource).toContain("<em>{model.counts.truncations} size trims</em>");
    expect(sharePageSource).toContain("<h2>Privacy &amp; Size Changes</h2>");
    expect(sharePageSource).toContain("No privacy redactions or size trims recorded");
    expect(sharePageSource).not.toContain('<label for="tab-summary">Summary</label>');
    expect(sharePageSource).not.toContain("<h2>Notices</h2>");
  });
});
