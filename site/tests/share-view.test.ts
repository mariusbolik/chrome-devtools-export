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
    expect(model.privacy.summaryRows).toEqual([
      { label: "Sensitive Values Redacted", value: "1", tone: "warn" },
      { label: "Bodies Partially Shown", value: "0", tone: "neutral" },
      { label: "Binary Bodies Omitted", value: "0", tone: "neutral" },
      { label: "Payloads Trimmed", value: "1", tone: "warn" },
      { label: "DOM Snapshot Hidden", value: "No", tone: "neutral" },
      { label: "Cookie Values Redacted", value: "0", tone: "neutral" },
    ]);
    expect(model.privacy.detailRows).toEqual([
      { label: "Sensitive field", value: "1", tone: "warn" },
      { label: "DOM snapshot exceeded upload budget", value: "1", tone: "warn" },
    ]);
  });

  test("builds issue, network, and performance diagnostics for developer triage", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com/app",
      title: "Example App",
      environment: {
        browser: {
          browser: { name: "Chrome", version: "126.0.0.0" },
          os: { name: "macOS", version: "15.0" },
        },
        viewport: { width: 390, height: 844, devicePixelRatio: 3 },
        screen: { width: 390, height: 844, colorDepth: 24 },
        language: "en-US",
        timezone: "America/New_York",
        hardwareConcurrency: 4,
        deviceMemory: 4,
        cloudflare: { country: "US", city: "New York", colo: "EWR" },
      },
      pageDiagnostics: {
        document: {
          readyState: "complete",
          visibilityState: "visible",
          online: true,
        },
        navigation: {
          type: "reload",
          duration: 2320.4,
          domContentLoaded: 640.2,
          loadEvent: 2260.8,
          responseEnd: 420.5,
        },
        paints: [
          { name: "first-paint", startTime: 380.2 },
          { name: "first-contentful-paint", startTime: 930.6 },
        ],
      },
      network: [
        {
          id: 1,
          method: "GET",
          url: "https://example.com/api/users",
          status: 500,
          time: 980,
          requestHeaders: { accept: "application/json" },
          responseHeaders: { "content-type": "application/json" },
          requestBody: null,
          responseBody: '{"error":"failed"}',
          source: "devtools",
        },
        {
          id: 2,
          method: "GET",
          url: "https://cdn.example.com/app.js",
          status: 0,
          time: 1850,
          requestHeaders: {},
          responseHeaders: {},
          requestBody: null,
          responseBody: null,
          source: "resource-timing",
          transferSize: 412000,
          decodedBodySize: 910000,
          initiatorType: "script",
        },
      ],
      console: [
        {
          id: 1,
          type: "error",
          text: "Unhandled Promise Rejection: TypeError: failed to fetch",
          timestamp: 1_784_000_000_000,
          source: "content",
          frameUrl: "https://example.com/app",
          isTop: true,
        },
        {
          id: 2,
          type: "warn",
          text: "Feature flag missing",
          timestamp: 1_784_000_000_100,
          source: "content",
        },
      ],
      cdp: {
        pageResources: [
          {
            name: "https://cdn.example.com/app.js",
            initiatorType: "script",
            duration: 1850.2,
            transferSize: 412000,
            encodedBodySize: 401000,
            decodedBodySize: 910000,
            responseStatus: 0,
          },
        ],
        errors: ["DOMSnapshot.captureSnapshot: failed"],
      },
    });

    const model = buildShareViewModel(snapshot);

    expect(model.captureFidelity).toEqual({
      mode: "mixed",
      label: "Mixed Capture",
      detail: "Includes DevTools network records and resource timing records with limited HTTP details.",
      tone: "warn",
    });
    expect(model.issues.items.map((issue) => [issue.severity, issue.title, issue.targetTab])).toEqual([
      ["error", "Console error", "console"],
      ["error", "Failed request", "network"],
      ["warn", "Slow resource", "network"],
      ["warn", "CDP capture issue", "environment"],
    ]);
    expect(model.issues.items[0].detail).toContain("failed to fetch");
    expect(model.issues.deviceRows).toContainEqual({ label: "Viewport", value: "390 x 844 @3x", valueType: "object" });
    expect(model.network.rows).toEqual([
      {
        id: 1,
        name: "/api/users",
        url: "https://example.com/api/users",
        safeUrl: "https://example.com/api/users",
        method: "GET",
        statusLabel: "500",
        statusTone: "error",
        type: "unknown",
        sourceLabel: "DevTools",
        captureNote: null,
        size: "18 B",
        time: "980ms",
        hasHeaders: true,
        hasPayload: false,
        hasResponse: true,
      },
      {
        id: 2,
        name: "/app.js",
        url: "https://cdn.example.com/app.js",
        safeUrl: "https://cdn.example.com/app.js",
        method: "UNKNOWN",
        statusLabel: "Not captured",
        statusTone: "neutral",
        type: "script",
        sourceLabel: "Resource Timing",
        captureNote: "HTTP status, headers, payload, and response body were not available from popup capture.",
        size: "402 kB transferred / 889 kB decoded",
        time: "1850ms",
        hasHeaders: false,
        hasPayload: false,
        hasResponse: false,
      },
    ]);
    expect(model.performance.navigationRows).toEqual([
      { label: "Navigation Type", value: "reload", valueType: "string" },
      { label: "Navigation Duration", value: "2320ms", valueType: "number" },
      { label: "Response End", value: "421ms", valueType: "number" },
      { label: "DOMContentLoaded", value: "640ms", valueType: "number" },
      { label: "Load Event", value: "2261ms", valueType: "number" },
    ]);
    expect(model.performance.paintRows).toEqual([
      { label: "first-paint", value: "380ms", valueType: "number" },
      { label: "first-contentful-paint", value: "931ms", valueType: "number" },
    ]);
  });

  test("builds a compact AI summary instead of dumping raw snapshot JSON", () => {
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
        viewport: { width: 1440, height: 900, devicePixelRatio: 2 },
        cloudflare: { country: "DE", city: "Berlin" },
      },
      network: [
        {
          id: 1,
          method: "GET",
          url: "https://example.com/api/users",
          status: 500,
          time: 980,
          requestHeaders: {},
          responseHeaders: {},
          requestBody: null,
          responseBody: '{"error":"failed"}',
          source: "devtools",
        },
      ],
      console: [
        {
          id: 1,
          type: "error",
          text: "Unhandled Promise Rejection: TypeError: failed to fetch",
          timestamp: 1_784_000_000_000,
          source: "content",
          frameUrl: "https://example.com/app",
          isTop: true,
        },
      ],
      storage: {
        localStorage: { feature: "enabled" },
        sessionStorage: {},
        cookies: {},
        indexedDB: {},
      },
    });

    const summary = buildShareViewModel(snapshot).aiSummary;

    expect(summary).toContain("DevToolsExport AI debug summary");
    expect(summary).toContain("Snapshot: #AbC234xy");
    expect(summary).toContain("Page: Example App (https://example.com/app)");
    expect(summary).toContain("Browser: Chrome 126.0.0.0");
    expect(summary).toContain("[error] Failed request: 500 GET /api/users");
    expect(summary).toContain("[error] Unhandled Promise Rejection: TypeError: failed to fetch");
    expect(summary).toContain("Storage entries: 1");
    expect(summary).not.toContain('"schemaVersion"');
    expect(summary.length).toBeLessThan(5000);
  });

  test("keeps console rows chronological and surfaces popup capture limitations as triage items", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com/app",
      environment: {
        viewport: { width: 390, height: 844, devicePixelRatio: 3 },
      },
      network: [
        {
          id: 1,
          method: "UNKNOWN",
          url: "https://example.com/app.js",
          status: 0,
          time: 45,
          source: "resource-timing",
          initiatorType: "script",
          requestHeaders: {},
          responseHeaders: {},
          requestBody: null,
          responseBody: null,
        },
      ],
      console: [
        { id: 1, type: "warn", text: "First warning", timestamp: 100, source: "content" },
        { id: 2, type: "error", text: "Second error", timestamp: 200, source: "content" },
      ],
      captureNotices: [{ path: "page", reason: "Content script capture failed; uploaded tab metadata only" }],
    });

    const model = buildShareViewModel(snapshot);

    expect(model.console.rows.map((row) => row.message)).toEqual(["First warning", "Second error"]);
    expect(model.issues.items.map((issue) => [issue.severity, issue.title, issue.targetTab])).toEqual([
      ["error", "Console error", "console"],
      ["warn", "Limited network evidence", "network"],
      ["warn", "Capture limitation", "environment"],
    ]);
    expect(model.issues.items.some((issue) => issue.title === "Mobile-sized viewport")).toBe(false);
    expect(model.network.rows[0]).toMatchObject({
      method: "UNKNOWN",
      statusLabel: "Not captured",
      sourceLabel: "Resource Timing",
      captureNote: "HTTP status, headers, payload, and response body were not available from popup capture.",
    });
  });

  test("groups repetitive body privacy notices for the overview", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com/app",
      redactions: [
        { path: "network[0].requestBody.password", reason: "Sensitive body value redacted" },
        { path: "network[0].responseBody.token", reason: "Sensitive body value redacted" },
        { path: "network[1].responseBody", reason: "Binary body omitted" },
        { path: "network[1].requestHeaders.Cookie", reason: "Cookie value redacted" },
        { path: "cdp.domSnapshot", reason: "DOM snapshot is sensitive by default" },
      ],
      truncations: [
        { path: "network[0].responseBody", reason: "Body preview trimmed", originalBytes: 64000 },
      ],
    });

    const model = buildShareViewModel(snapshot);

    expect(model.privacy.summaryRows).toEqual([
      { label: "Sensitive Values Redacted", value: "4", tone: "warn" },
      { label: "Bodies Partially Shown", value: "2", tone: "ok" },
      { label: "Binary Bodies Omitted", value: "1", tone: "warn" },
      { label: "Payloads Trimmed", value: "1", tone: "warn" },
      { label: "DOM Snapshot Hidden", value: "Yes", tone: "warn" },
      { label: "Cookie Values Redacted", value: "1", tone: "warn" },
    ]);
    expect(model.privacy.detailRows).toEqual([
      { label: "Sensitive body value redacted", value: "2", tone: "warn" },
      { label: "Binary body omitted", value: "1", tone: "warn" },
      { label: "Cookie value redacted", value: "1", tone: "warn" },
      { label: "DOM snapshot is sensitive by default", value: "1", tone: "warn" },
      { label: "Body preview trimmed", value: "1", tone: "warn" },
    ]);
  });

  test("treats legacy status-zero popup rows as resource timing captures", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com/app",
      network: [
        {
          id: 1,
          method: "GET",
          url: "https://example.com/app.js",
          status: 0,
          time: 12,
          requestHeaders: {},
          responseHeaders: {},
          requestBody: null,
          responseBody: null,
        },
      ],
    });

    const model = buildShareViewModel(snapshot);

    expect(model.captureFidelity.mode).toBe("resource-timing");
    expect(model.network.rows[0].sourceLabel).toBe("Resource Timing");
    expect(model.network.rows[0].method).toBe("UNKNOWN");
    expect(model.network.rows[0].statusLabel).toBe("Not captured");
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
    expect(model.cdp.hasScreenshot).toBe(false);
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
    expect(model.cdp.hasScreenshot).toBe(true);
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
