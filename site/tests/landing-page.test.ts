import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const pageSource = readFileSync(new URL("../src/pages/index.astro", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../src/layouts/SiteLayout.astro", import.meta.url), "utf8");
const lowerPageSource = pageSource.toLowerCase();

describe("landing page", () => {
  test("defines SEO and social sharing metadata", () => {
    expect(pageSource).toContain('title="DevToolsExport - Share Chrome DevTools Snapshots to Fix Bugs Faster"');
    expect(layoutSource).toContain("<title>{title}</title>");
    expect(layoutSource).toContain('<meta name="description" content={description} />');
    expect(pageSource).toContain("one-click bug reports");
    expect(pageSource).toContain("DevTools snapshots");
    expect(pageSource).toContain("console logs");
    expect(pageSource).toContain("network requests");
    expect(pageSource).toContain('canonical="https://devtoolsexport.com/"');
    expect(layoutSource).toContain('<link rel="canonical" href={canonical} />');
    expect(layoutSource).toContain('<meta property="og:type" content={ogType} />');
    expect(layoutSource).toContain('<meta property="og:site_name" content="DevToolsExport" />');
    expect(layoutSource).toContain('<meta property="og:title" content={title} />');
    expect(layoutSource).toContain('<meta property="og:description" content={description} />');
    expect(layoutSource).toContain('<meta property="og:url" content={canonical} />');
    expect(layoutSource).toContain('<meta property="og:image" content={imageUrl} />');
    expect(layoutSource).toContain('<meta property="og:image:secure_url" content={imageUrl} />');
    expect(layoutSource).toContain('<meta property="og:image:type" content="image/png" />');
    expect(layoutSource).toContain('<meta property="og:image:width" content={String(imageWidth)} />');
    expect(layoutSource).toContain('<meta property="og:image:height" content={String(imageHeight)} />');
    expect(layoutSource).toContain('<meta property="og:image:alt" content={imageAlt} />');
    expect(layoutSource).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(layoutSource).toContain('<meta name="twitter:title" content={title} />');
    expect(layoutSource).toContain('<meta name="twitter:description" content={description} />');
    expect(layoutSource).toContain('<meta name="twitter:image" content={imageUrl} />');
    expect(layoutSource).toContain('<meta name="twitter:image:alt" content={imageAlt} />');
    expect(layoutSource).toContain('imageUrl = "https://devtoolsexport.com/og-image.png"');
    expect(pageSource).toContain('"image": "https://devtoolsexport.com/og-image.png"');
    expect(existsSync(new URL("../public/og-image.png", import.meta.url))).toBe(true);
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
    expect(pageSource.match(/class="button-icon/g)?.length).toBe(3);
    expect(pageSource.match(/class="button-icon chrome-icon"/g)?.length).toBe(2);
    expect(pageSource).toContain("<title>chrome</title>");
    expect(pageSource).toContain('class="button-icon github-icon"');
    expect(pageSource).toContain("<title>github</title>");
    expect(pageSource).toContain(".button.primary .button-icon");
  });

  test("removes the manual copying section and adds a large bottom Chrome Store button", () => {
    expect(pageSource).not.toContain("Manual DevTools copying slows every fix.");
    expect(pageSource).not.toContain('class="section problem"');
    expect(pageSource).toContain('class="bottom-install"');
    expect(pageSource).toContain('class="button primary giant-store-button"');
    expect(pageSource).toContain(".giant-store-button");
  });

  test("renders creator social links outside the footer and copyright text in the footer", () => {
    expect(pageSource).toContain('<section class="creator-follow" aria-labelledby="creator-title">');
    expect(pageSource).toContain('<h2 id="creator-title">Follow the creator</h2>');
    expect(pageSource).toContain("https://x.com/mariusbolik");
    expect(pageSource).toContain("https://www.linkedin.com/in/marius-bolik/");
    expect(pageSource).toContain("@mariusbolik");
    expect(pageSource).toContain("Marius Bolik");
    expect(pageSource).toContain('class="social-icon x-icon"');
    expect(pageSource).toContain('class="social-icon linkedin-icon"');
    expect(layoutSource).toContain("&copy; 2026 Eyloo GmbH. All rights reserved.");
    expect(pageSource).not.toContain(">x.com/mariusbolik</a>");
    expect(pageSource).not.toContain("<footer>\n      <span>Eyloo GmbH</span>");
  });

  test("links to privacy, contact, and terms pages from the footer", () => {
    expect(layoutSource).toContain('href="/privacy/"');
    expect(layoutSource).toContain('href="/contact/"');
    expect(layoutSource).toContain('href="/terms/"');
  });

  test("uses the shared site layout for common page chrome", () => {
    expect(pageSource).toContain('import SiteLayout from "../layouts/SiteLayout.astro";');
    expect(pageSource).toContain("<SiteLayout");
    expect(pageSource).not.toContain("<!doctype html>");
    expect(layoutSource).toContain("<!doctype html>");
    expect(layoutSource).toContain('<footer class="site-footer">');
  });

  test("alternates landing section background colors", () => {
    expect(pageSource).toContain(".solution,\n  .trust,\n  .creator-follow {\n    background: #191a1a;\n  }");
    expect(pageSource).toContain(".proof,\n  .bottom-install {\n    background: var(--bg);\n  }");
    expect(pageSource).not.toContain(".solution,\n  .trust {\n    background: var(--bg);\n  }");
    expect(pageSource).not.toContain(".proof {\n    background: #191a1a;\n  }");
  });

  test("uses the main blue accent for small eyebrow headings", () => {
    expect(pageSource).toContain(".eyebrow {\n    margin: 0 0 10px;\n    color: var(--blue);");
    expect(pageSource).not.toContain(".eyebrow {\n    margin: 0 0 10px;\n    color: var(--green);");
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

  test("uses the requested descriptive hero headline", () => {
    expect(pageSource).toContain("<h1 id=\"hero-title\">Export Content from Chrome DevTools</h1>");
    expect(pageSource).not.toContain("Export Console Logs, Network Requests, etc. from Google Chrome DevTools");
    expect(pageSource).not.toContain("<h1 id=\"hero-title\">DevToolsExport</h1>");
    expect(pageSource).toContain("font-size: clamp(34px, 5vw, 58px);");
    expect(pageSource).toContain("word-break: keep-all;");
    expect(pageSource).toContain("h2,\n  h3,\n  p {\n    overflow-wrap: anywhere;");
    expect(pageSource).not.toContain("h1,\n  h2,\n  h3,\n  p {\n    overflow-wrap: anywhere;");
  });

  test("uses updated section headings and unboxed solution steps", () => {
    expect(pageSource).toContain('<h2 id="solution-title">Create sharable bug reports in one click.</h2>');
    expect(pageSource).not.toContain("Send the debugging context as a link.");
    expect(pageSource).toContain(
      '<h2 id="captured-data-title">Share links to the snapshot of your DevTools with developers to fix bug faster.</h2>',
    );
    expect(pageSource).not.toContain("The report is organized like the DevTools data they already use.");
    expect(pageSource).not.toContain(".steps li,\n  .trust-list div");
    expect(pageSource).not.toContain("min-height: 86px;");
  });

  test("uses blue icon boxes for solution steps and unboxed trust items with real SVG icons", () => {
    expect(pageSource.match(/class="trust-item"/g)?.length).toBe(3);
    expect(pageSource.match(/class="trust-icon"/g)?.length).toBe(3);
    expect(pageSource).toContain('class="trust-icon" aria-hidden="true"');
    expect(pageSource).toContain('class="trust-icon-svg currency-icon"');
    expect(pageSource).toContain('class="trust-icon-svg clock-icon"');
    expect(pageSource).toContain('class="trust-icon-svg shield-icon"');
    expect(pageSource).toContain(".steps span,\n  .trust-icon");
    expect(pageSource).toContain("border: 1px solid rgba(86, 156, 214, 0.55);");
    expect(pageSource).toContain("background: rgba(86, 156, 214, 0.12);");
    expect(pageSource).toContain("color: var(--blue);");
    expect(pageSource).toContain(".trust-icon-svg");
    expect(pageSource).not.toContain('<span class="trust-icon" aria-hidden="true">0</span>');
    expect(pageSource).not.toContain('<span class="trust-icon" aria-hidden="true">7d</span>');
    expect(pageSource).not.toContain('<span class="trust-icon" aria-hidden="true">***</span>');
    expect(pageSource).not.toContain("rgba(78, 201, 176, 0.5)");
    expect(pageSource).not.toContain("rgba(78, 201, 176, 0.1)");
    expect(pageSource).not.toContain(".trust-list div {\n    border:");
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
