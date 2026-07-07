import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const source = readFileSync(new URL("../src/pages/share/[id]/index.astro", import.meta.url), "utf8");
const inlineScript = source.match(/<script is:inline>\s*([\s\S]*?)\s*<\/script>/)?.[1];

if (!inlineScript) {
  throw new Error("Share page inline script was not found");
}

function fixtureHtml() {
  return `<!doctype html>
    <html>
      <body>
        <nav class="tabs" role="tablist">
          <a id="triage-tab" href="#triage" role="tab" data-tab="triage" aria-selected="true">Triage</a>
          <a id="ai-summary-tab" href="#ai-summary" role="tab" data-tab="ai-summary" aria-selected="false">AI Summary</a>
          <a id="console-tab" href="#console" role="tab" data-tab="console" aria-selected="false">Console</a>
          <a id="network-tab" href="#network" role="tab" data-tab="network" aria-selected="false">Network</a>
        </nav>
        <a class="issue-row" href="#network-1">Network issue</a>
        <span id="expiryCountdown" data-expires-at="2099-01-01T00:00:00.000Z">Expires in ...</span>
        <section id="triage" data-panel="triage" role="tabpanel">triage</section>
        <section id="ai-summary" data-panel="ai-summary" role="tabpanel" hidden>
          <textarea id="aiSummaryText" readonly>Compact debug summary</textarea>
          <button type="button" data-copy-target="aiSummaryText">Copy</button>
        </section>
        <section id="console" data-panel="console" role="tabpanel" hidden>
          <button type="button" data-console-filter="all" class="filter-chip active">All</button>
          <button type="button" data-console-filter="error" class="filter-chip">Errors</button>
          <details data-console-severity="warn"><summary>Warning</summary></details>
          <details data-console-severity="error"><summary>Error</summary></details>
        </section>
        <section id="network" data-panel="network" role="tabpanel" hidden>
          <details id="network-1" class="network-item">
            <summary>network 1</summary>
            <div>network details</div>
          </details>
          <details id="network-2" class="network-item">
            <summary>network 2</summary>
            <div>network details</div>
          </details>
        </section>
        <script>${inlineScript}</script>
      </body>
    </html>`;
}

test("share page script keeps hash tabs and console filters usable", async ({ page }) => {
  await page.setContent(fixtureHtml());

  await expect(page.locator('[data-panel="triage"]')).toBeVisible();
  await expect(page.locator('[data-panel="console"]')).toBeHidden();

  await page.locator('a[href="#ai-summary"]').click();
  await expect(page).toHaveURL(/#ai-summary$/);
  await expect(page.locator('[data-tab="ai-summary"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-panel="ai-summary"]')).toBeVisible();

  await page.locator('a[href="#console"]').click();
  await expect(page).toHaveURL(/#console$/);
  await expect(page.locator('[data-tab="console"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-panel="console"]')).toBeVisible();
  await expect(page.locator('[data-panel="triage"]')).toBeHidden();

  await page.locator('[data-console-filter="error"]').click();
  await expect(page.locator('[data-console-severity="error"]')).toBeVisible();
  await expect(page.locator('[data-console-severity="warn"]')).toBeHidden();

  await page.locator(".issue-row").click();
  await expect(page).toHaveURL(/#network-1$/);
  await expect(page.locator('[data-tab="network"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-panel="network"]')).toBeVisible();
  await expect(page.locator("#network-1")).toHaveAttribute("open", "");

  await page.locator("#network-2 > summary").click();
  await expect(page).toHaveURL(/#network-2$/);
});
