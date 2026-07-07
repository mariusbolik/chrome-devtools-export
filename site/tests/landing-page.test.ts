import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const pageSource = readFileSync(new URL("../src/pages/index.astro", import.meta.url), "utf8");
const lowerPageSource = pageSource.toLowerCase();

describe("landing page", () => {
  test("defines SEO and social sharing metadata", () => {
    expect(pageSource).toContain("<title>DevToolsExport - Share Chrome DevTools Snapshots to Fix Bugs Faster</title>");
    expect(pageSource).toContain('<meta name="description"');
    expect(pageSource).toContain("one-click bug reports");
    expect(pageSource).toContain("DevTools snapshots");
    expect(pageSource).toContain("console logs");
    expect(pageSource).toContain("network requests");
    expect(pageSource).toContain('<link rel="canonical" href="https://devtoolsexport.com/" />');
    expect(pageSource).toContain('<meta property="og:title"');
    expect(pageSource).toContain('<meta property="og:description"');
    expect(pageSource).toContain('<meta property="og:url" content="https://devtoolsexport.com/" />');
    expect(pageSource).toContain('<meta property="og:image" content="https://devtoolsexport.com/screenshots/chrome-export-panel.png" />');
    expect(pageSource).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(pageSource).toContain('<meta name="twitter:title"');
    expect(pageSource).toContain('<meta name="twitter:description"');
    expect(pageSource).toContain('<meta name="twitter:image" content="https://devtoolsexport.com/screenshots/chrome-export-panel.png" />');
  });

  test("includes SoftwareApplication schema for the free Chrome extension", () => {
    expect(pageSource).toContain('"@type": "SoftwareApplication"');
    expect(pageSource).toContain('"name": "DevToolsExport"');
    expect(pageSource).toContain('"applicationCategory": "DeveloperApplication"');
    expect(pageSource).toContain('"operatingSystem": "Chrome"');
    expect(pageSource).toContain('"price": "0"');
  });

  test("links to install the extension and view the source code", () => {
    expect(pageSource).toContain(
      "https://chromewebstore.google.com/detail/devtools-export/pbdgpdjgngniklhkclaafnekfidohhbm",
    );
    expect(pageSource).toContain("Install free Chrome extension");
    expect(pageSource).toContain("https://github.com/mariusbolik/chrome-devtools-export");
    expect(pageSource).toContain("View on GitHub");
  });

  test("renders icons in the primary install and GitHub buttons", () => {
    expect(pageSource.match(/class="button-icon/g)?.length).toBe(2);
    expect(pageSource).toContain('class="button-icon chrome-icon"');
    expect(pageSource).toContain("<title>chrome</title>");
    expect(pageSource).toContain('class="button-icon github-icon"');
    expect(pageSource).toContain("<title>github</title>");
    expect(pageSource).toContain(".button.primary .button-icon");
  });

  test("renders required footer attribution links", () => {
    expect(pageSource).toContain("Eyloo GmbH");
    expect(pageSource).toContain("https://x.com/mariusbolik");
    expect(pageSource).toContain("https://www.linkedin.com/in/marius-bolik/");
  });

  test("references product screenshots from the public screenshots directory", () => {
    expect(pageSource).toContain("/screenshots/chrome-export-panel.png");
    expect(pageSource).toContain("/screenshots/extension-popup.png");
    expect(pageSource).toContain("/screenshots/share-network.png");
    expect(pageSource).toContain("/screenshots/share-console-logs.png");
    expect(pageSource).toContain("/screenshots/share-ai-summary.png");
  });

  test("communicates the core product promise", () => {
    for (const phrase of [
      "fix bugs faster",
      "free",
      "one click",
      "console logs",
      "network requests",
      "devtools snapshot",
    ]) {
      expect(lowerPageSource).toContain(phrase);
    }
  });

  test("keeps the hero brand headline from breaking inside the word", () => {
    expect(pageSource).toContain("font-size: clamp(42px, 6vw, 64px);");
    expect(pageSource).toContain("word-break: keep-all;");
    expect(pageSource).toContain("h2,\n  h3,\n  p {\n    overflow-wrap: anywhere;");
    expect(pageSource).not.toContain("h1,\n  h2,\n  h3,\n  p {\n    overflow-wrap: anywhere;");
  });

  test("presents the proof screenshots as a simple one-slide carousel", () => {
    expect(pageSource).toContain('class="proof-carousel"');
    expect(pageSource).toContain("data-proof-carousel");
    expect(pageSource.match(/data-proof-slide=/g)?.length).toBe(3);
    expect(pageSource.match(/data-proof-dot=/g)?.length).toBe(3);
    expect(pageSource).toContain("data-proof-prev");
    expect(pageSource).toContain("data-proof-next");
    expect(pageSource).toContain('id="proof-network-slide" data-proof-slide="network"');
    expect(pageSource).toContain('id="proof-console-slide" data-proof-slide="console" hidden');
    expect(pageSource).toContain('id="proof-summary-slide" data-proof-slide="summary" hidden');
    expect(pageSource).toContain("[data-proof-carousel]");
    expect(pageSource).toContain("[data-proof-slide]");
    expect(pageSource).toContain("[data-proof-dot]");
    expect(pageSource).toContain("[data-proof-prev]");
    expect(pageSource).toContain("[data-proof-next]");
    expect(pageSource).toContain("grid-template-columns: 1fr;");
    expect(pageSource).toContain("right: 12px;");
    expect(pageSource).toContain("max-width: 780px;");
    expect(pageSource).toContain(".proof-slide[hidden]");
    expect(pageSource).not.toContain("grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.5fr);");
    expect(pageSource).not.toContain("right: calc(25% + 44px);");
    expect(pageSource).not.toContain('class="proof-slide-nav"');
    expect(pageSource).not.toContain('class="proof-tab');
    expect(pageSource).not.toContain('class="proof-track"');
    expect(pageSource).not.toContain("scroll-snap-type");
    expect(pageSource).not.toContain('class="proof-grid"');
  });

  test("shows share report screenshots inside a browser frame with the share URL", () => {
    expect(pageSource.match(/class="browser-frame screenshot-frame"/g)?.length).toBe(3);
    expect(pageSource.match(/class="browser-bar"/g)?.length).toBe(3);
    expect(pageSource.match(/class="browser-url"/g)?.length).toBe(3);
    expect(pageSource.match(/https:\/\/devtoolsexport\.com\/share\/a7k9m2q4\//g)?.length).toBe(3);
    expect(pageSource).toContain(".browser-bar");
    expect(pageSource).toContain(".browser-url");
  });
});
