import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const pagePaths = {
  privacy: new URL("../src/pages/privacy.astro", import.meta.url),
  contact: new URL("../src/pages/contact.astro", import.meta.url),
  terms: new URL("../src/pages/terms.astro", import.meta.url),
};

const readPage = (page: keyof typeof pagePaths) => readFileSync(pagePaths[page], "utf8");

describe("legal and contact pages", () => {
  test("adds public privacy, contact, and terms pages", () => {
    for (const pagePath of Object.values(pagePaths)) {
      expect(existsSync(pagePath)).toBe(true);
    }
  });

  test("privacy page explains Chrome Web Store data handling", () => {
    const pageSource = readPage("privacy");

    expect(pageSource).toContain("<title>Privacy Policy - DevToolsExport</title>");
    expect(pageSource).toContain("<h1>Privacy Policy</h1>");
    expect(pageSource).toContain("DevTools snapshots");
    expect(pageSource).toContain("console logs");
    expect(pageSource).toContain("network requests");
    expect(pageSource).toContain("optional screenshots");
    expect(pageSource).toContain("default redaction");
    expect(pageSource).toContain("unlisted share links");
    expect(pageSource).toContain("HTTPS");
    expect(pageSource).toContain("We do not sell user data");
  });

  test("contact page points users to X instead of an email address", () => {
    const pageSource = readPage("contact");

    expect(pageSource).toContain("<title>Contact - DevToolsExport</title>");
    expect(pageSource).toContain("<h1>Contact</h1>");
    expect(pageSource).toContain("write me on X");
    expect(pageSource).toContain("https://x.com/mariusbolik");
    expect(pageSource).toContain("@mariusbolik");
  });

  test("terms page states simple service terms for shared bug reports", () => {
    const pageSource = readPage("terms");

    expect(pageSource).toContain("<title>Terms of Service - DevToolsExport</title>");
    expect(pageSource).toContain("<h1>Terms of Service</h1>");
    expect(pageSource).toContain("free Chrome extension");
    expect(pageSource).toContain("share links");
    expect(pageSource).toContain("anyone with the link can view");
    expect(pageSource).toContain("provided as is");
  });

  test("uses the main blue accent for legal page eyebrow headings", () => {
    for (const pagePath of Object.values(pagePaths)) {
      const pageSource = readFileSync(pagePath, "utf8");

      expect(pageSource).toContain(".eyebrow {\n    margin: 0 0 10px;\n    color: var(--blue);");
      expect(pageSource).not.toContain(".eyebrow {\n    margin: 0 0 10px;\n    color: var(--green);");
    }
  });
});
