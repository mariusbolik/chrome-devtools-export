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

    expect(model.seoTitle).toBe("DevToolsExport #AbC234xy");
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

  test("builds DOM and CDP UI sections from captured details", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com",
      cdp: {
        screenshotDataUrl: "[REDACTED]",
        domSnapshot: "[REDACTED]",
        layoutMetrics: {
          cssLayoutViewport: { clientWidth: 1280, clientHeight: 720 },
          contentSize: { width: 1280, height: 2400 },
        },
        performanceMetrics: {
          metrics: [
            { name: "JSHeapUsedSize", value: 123456 },
            { name: "Nodes", value: 42 },
          ],
        },
        pageAssets: {
          images: ["https://example.com/logo.png"],
          scripts: ["https://example.com/app.js"],
          stylesheets: ["https://example.com/app.css"],
        },
        pageResources: [
          { name: "https://example.com/api/data?token=redacted", initiatorType: "fetch", duration: 42.6 },
        ],
        errors: ["DOMSnapshot.captureSnapshot: failed"],
      },
    });

    const model = buildShareViewModel(snapshot);

    expect(model.cdp.statusRows).toEqual([
      { label: "DOM Snapshot", value: "Redacted", tone: "warn" },
      { label: "Performance Metrics", value: "2 metrics", tone: "ok" },
      { label: "CDP Errors", value: "1 error", tone: "error" },
    ]);
    expect(model.cdp.screenshot).toEqual({
      state: "missing",
      label: "Screenshot not captured",
      src: null,
    });
    expect(model.cdp.layoutRows).toEqual([
      { label: "Viewport", value: "1280 x 720", valueType: "object" },
      { label: "Content Size", value: "1280 x 2400", valueType: "object" },
    ]);
    expect(model.cdp.performanceRows).toEqual([
      { label: "JSHeapUsedSize", value: "123456", valueType: "number" },
      { label: "Nodes", value: "42", valueType: "number" },
    ]);
    expect(model.cdp.assets.map((asset) => [asset.type, asset.path, asset.safeUrl])).toEqual([
      ["Image", "/logo.png", "https://example.com/logo.png"],
      ["Script", "/app.js", "https://example.com/app.js"],
      ["Stylesheet", "/app.css", "https://example.com/app.css"],
    ]);
    expect(model.cdp.resources[0]).toEqual({
      initiatorType: "fetch",
      path: "/api/data?token=redacted",
      duration: "43ms",
      url: "https://example.com/api/data?token=redacted",
      safeUrl: "https://example.com/api/data?token=redacted",
    });
    expect(model.cdp.errors).toEqual(["DOMSnapshot.captureSnapshot: failed"]);
  });

  test("shows a screenshot only when the CDP payload contains an image", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com",
      cdp: {
        screenshotDataUrl: "data:image/png;base64,screenshot-image",
      },
    });

    const model = buildShareViewModel(snapshot);

    expect(model.cdp.screenshot).toEqual({
      state: "available",
      label: "Captured",
      src: "data:image/png;base64,screenshot-image",
    });
    expect(model.cdp.statusRows[0]).toEqual({ label: "Screenshot", value: "Captured", tone: "ok" });
  });

  test("builds environment UI sections and installed extension rows", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com",
      extension: {
        id: "devtools-export",
        version: "1.0.0",
      },
      environment: {
        userAgent: "Mozilla/5.0 Chrome/126.0.0.0",
        language: "en-US",
        languages: ["en-US", "de-DE"],
        platform: "macOS",
        vendor: "Google Inc.",
        hardwareConcurrency: 10,
        deviceMemory: 8,
        timezone: "Europe/Berlin",
        screen: { width: 3024, height: 1964, colorDepth: 30 },
        viewport: { width: 1280, height: 720, devicePixelRatio: 2 },
        browser: {
          browser: { name: "Chrome", version: "126.0.0.0" },
          os: { name: "macOS", version: "15.0" },
          cpu: { architecture: "arm64" },
        },
        cloudflare: {
          country: "DE",
          city: "Berlin",
          colo: "FRA",
          timezone: "Europe/Berlin",
        },
      },
      installedExtensions: [
        {
          id: "a",
          name: "React DevTools",
          version: "5.0.0",
          enabled: true,
          type: "extension",
          installType: "normal",
          permissions: ["storage", "tabs"],
          hostPermissions: ["<all_urls>"],
        },
      ],
    });

    const model = buildShareViewModel(snapshot);

    expect(model.environment.sections.map((section) => [section.id, section.rows.length])).toEqual([
      ["browser", 5],
      ["device", 6],
      ["location", 4],
      ["extension", 2],
    ]);
    expect(model.environment.sections[0].rows.slice(0, 2)).toEqual([
      { label: "Browser", value: "Chrome 126.0.0.0", valueType: "string" },
      { label: "OS", value: "macOS 15.0", valueType: "string" },
    ]);
    expect(model.environment.sections[1].rows).toContainEqual({
      label: "Viewport",
      value: "1280 x 720 @2x",
      valueType: "object",
    });
    expect(model.environment.sections[1].rows).toContainEqual({
      label: "Screen",
      value: "3024 x 1964, 30-bit color",
      valueType: "object",
    });
    expect(model.environment.sections[2].rows).toContainEqual({
      label: "Location",
      value: "Berlin, DE",
      valueType: "string",
    });
    expect(model.environment.installedExtensions).toEqual([
      {
        id: "a",
        name: "React DevTools",
        version: "5.0.0",
        enabled: "Enabled",
        type: "extension",
        installType: "normal",
        permissions: "2 permissions",
        hostPermissions: "1 host permission",
      },
    ]);
  });
});
