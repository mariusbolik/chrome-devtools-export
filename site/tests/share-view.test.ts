import { describe, expect, test } from "bun:test";
import { createSnapshot } from "../../shared/snapshot";
import { buildShareViewModel } from "../src/lib/share-view";

describe("share view model", () => {
  test("summarizes snapshot counts, status, browser, country, and asset URLs", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com/app",
      title: "Example App",
      createdAt: "2026-07-06T12:00:00.000Z",
      expiresAt: "2026-08-05T12:00:00.000Z",
      environment: {
        browser: {
          browser: { name: "Chrome", version: "126.0.0.0" },
          os: { name: "macOS", version: "15.0" },
        },
        cloudflare: {
          country: "DE",
          city: "Berlin",
          timezone: "Europe/Berlin",
        },
      },
      network: [
        {
          id: 1,
          method: "GET",
          url: "https://example.com/api",
          status: 200,
          time: 12,
          requestHeaders: {},
          responseHeaders: {},
          requestBody: null,
          responseBody: null,
        },
        {
          id: 2,
          method: "POST",
          url: "https://example.com/fail",
          status: 500,
          time: 40,
          requestHeaders: {},
          responseHeaders: {},
          requestBody: null,
          responseBody: null,
        },
      ],
      console: [
        { id: 1, type: "error", text: "Failed", timestamp: 1, source: "content" },
        { id: 2, type: "warn", text: "Slow", timestamp: 2, source: "content" },
      ],
      redactions: [{ path: "network[0].requestHeaders.Authorization", reason: "Sensitive field" }],
      truncations: [{ path: "cdp.domSnapshot", reason: "DOM snapshot exceeded upload budget" }],
    });

    const model = buildShareViewModel(snapshot);

    expect(model.title).toBe("Example App");
    expect(model.domain).toBe("example.com");
    expect(model.safeUrl).toBe("https://example.com/app");
    expect(model.browser.label).toBe("Chrome 126.0.0.0");
    expect(model.browser.iconUrl).toBe("https://cdn.jsdelivr.net/gh/alrra/browser-logos@main/src/chrome/chrome.svg");
    expect(model.location.label).toBe("Berlin, DE");
    expect(model.location.flagUrl).toBe("https://cdn.jsdelivr.net/npm/flagpack@1.0.5/flags/1x1/de.svg");
    expect(model.counts).toEqual({
      network: 2,
      networkErrors: 1,
      console: 2,
      consoleErrors: 1,
      storageBuckets: 4,
      installedExtensions: 0,
      redactions: 1,
      truncations: 1,
    });
  });

  test("replaces unsafe page hrefs with a non-clickable fallback", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com",
    });
    snapshot.page.url = "javascript:alert(1)";

    const model = buildShareViewModel(snapshot);

    expect(model.url).toBe("javascript:alert(1)");
    expect(model.safeUrl).toBe("#");
  });

  test("builds storage sections for key-value UI rows", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com",
      storage: {
        localStorage: {
          theme: "dark",
          enabled: true,
        },
        sessionStorage: {},
        cookies: {
          sid: "[REDACTED]",
        },
        indexedDB: {
          app: {
            version: 2,
            stores: ["users", "settings"],
          },
        },
      },
    });

    const model = buildShareViewModel(snapshot);

    expect(model.storage.totalRows).toBe(4);
    expect(model.storage.sections.map((section) => [section.id, section.label, section.rows.length])).toEqual([
      ["localStorage", "Local Storage", 2],
      ["sessionStorage", "Session Storage", 0],
      ["cookies", "Cookies", 1],
      ["indexedDB", "IndexedDB", 1],
    ]);
    expect(model.storage.sections[0].rows).toEqual([
      { key: "enabled", value: "true", valueType: "boolean" },
      { key: "theme", value: "dark", valueType: "string" },
    ]);
    expect(model.storage.sections[3].rows[0]).toEqual({
      key: "app",
      value: "version 2, stores: users, settings",
      valueType: "object",
    });
  });
});
