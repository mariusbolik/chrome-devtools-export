import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const pages = [
  readFileSync(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
  readFileSync(new URL("../src/pages/privacy.astro", import.meta.url), "utf8"),
  readFileSync(new URL("../src/pages/contact.astro", import.meta.url), "utf8"),
  readFileSync(new URL("../src/pages/terms.astro", import.meta.url), "utf8"),
  readFileSync(new URL("../src/pages/share/[id]/index.astro", import.meta.url), "utf8"),
];

describe("site assets", () => {
  test("uses public favicon metadata on every HTML page", () => {
    for (const pageSource of pages) {
      expect(pageSource).toContain('<link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />');
      expect(pageSource).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
      expect(pageSource).toContain('<link rel="shortcut icon" href="/favicon.ico" />');
      expect(pageSource).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />');
      expect(pageSource).toContain('<meta name="apple-mobile-web-app-title" content="DevTools" />');
      expect(pageSource).toContain('<link rel="manifest" href="/site.webmanifest" />');
    }
  });

  test("uses the new public logo path instead of the removed assets folder", () => {
    for (const pageSource of pages) {
      expect(pageSource).toContain('src="/favicon.svg"');
      expect(pageSource).not.toContain("/assets/icon/");
    }
  });
});
