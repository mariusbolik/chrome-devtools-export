import { describe, expect, test } from "bun:test";
import { buildDirectSnapshotInput, type PageCapture } from "../../src/direct-share";

describe("direct share snapshot input", () => {
  test("uses active-tab capture data without requiring the DevTools panel", () => {
    const page: PageCapture = {
      url: "https://example.com/app",
      title: "Example App",
      referrer: "",
      userAgent: "Mozilla/5.0 Chrome/126.0.0.0",
      viewport: { width: 1440, height: 900 },
      screen: { width: 1440, height: 900 },
      storage: {
        localStorage: { token: "secret" },
        sessionStorage: {},
        cookies: {},
        indexedDB: {},
      },
      resources: [
        {
          name: "https://example.com/app.js",
          initiatorType: "script",
          duration: 12.4,
          transferSize: 128000,
          encodedBodySize: 120000,
          decodedBodySize: 260000,
          responseStatus: 200,
        },
        { name: "https://example.com/style.css", initiatorType: "link", duration: 4.2, responseStatus: 0 },
      ],
      pageDiagnostics: {
        document: {
          readyState: "complete",
          visibilityState: "visible",
          online: true,
        },
        navigation: {
          type: "navigate",
          duration: 530.4,
          domContentLoaded: 240.2,
          loadEvent: 510.9,
          responseEnd: 180.5,
        },
        paints: [{ name: "first-contentful-paint", startTime: 320.5 }],
      },
      assets: {
        images: ["https://example.com/logo.png"],
        scripts: ["https://example.com/app.js"],
        stylesheets: ["https://example.com/style.css"],
      },
      captureNotices: [{ path: "page", reason: "Content script capture failed; uploaded tab metadata only" }],
    };

    const input = buildDirectSnapshotInput({
      id: "AbC234xy",
      page,
      extension: { id: "ext", version: "1.0.0" },
      environment: { language: "en-US" },
      installedExtensions: [],
      consoleLogs: [],
      cdp: { errors: ["Page.captureScreenshot: denied"] },
    });

    expect(input.url).toBe("https://example.com/app");
    expect(input.network).toEqual([
      {
        id: 1,
        method: "UNKNOWN",
        url: "https://example.com/app.js",
        status: 200,
        time: 12,
        source: "resource-timing",
        initiatorType: "script",
        transferSize: 128000,
        encodedBodySize: 120000,
        decodedBodySize: 260000,
        requestHeaders: {},
        responseHeaders: {},
        requestBody: null,
        responseBody: null,
      },
      {
        id: 2,
        method: "UNKNOWN",
        url: "https://example.com/style.css",
        status: 0,
        time: 4,
        source: "resource-timing",
        initiatorType: "link",
        requestHeaders: {},
        responseHeaders: {},
        requestBody: null,
        responseBody: null,
      },
    ]);
    expect(input.storage?.localStorage).toEqual({ token: "secret" });
    expect(input.cdp?.pageAssets).toEqual(page.assets);
    expect(input.cdp?.pageResources).toEqual(page.resources);
    expect(input.pageDiagnostics).toEqual(page.pageDiagnostics);
    expect(input.cdp?.errors).toEqual(["Page.captureScreenshot: denied"]);
    expect(input.captureNotices).toEqual([{ path: "page", reason: "Content script capture failed; uploaded tab metadata only" }]);
  });
});
