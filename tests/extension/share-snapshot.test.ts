import { describe, expect, test } from "bun:test";
import {
  normalizeInstalledExtensions,
  prepareSnapshotForUpload,
} from "../../src/share-snapshot";

describe("extension share snapshot helpers", () => {
  test("normalizeInstalledExtensions keeps only debugger-relevant extension fields", () => {
    const result = normalizeInstalledExtensions([
      {
        id: "abc",
        name: "Debug Helper",
        version: "1.2.3",
        enabled: true,
        type: "extension",
        installType: "normal",
        permissions: ["tabs", "storage"],
        hostPermissions: ["https://example.com/*"],
        description: "Should not be uploaded",
        optionsUrl: "chrome-extension://abc/options.html",
      } as chrome.management.ExtensionInfo,
    ]);

    expect(result).toEqual([
      {
        id: "abc",
        name: "Debug Helper",
        version: "1.2.3",
        enabled: true,
        type: "extension",
        installType: "normal",
        permissions: ["tabs", "storage"],
        hostPermissions: ["https://example.com/*"],
      },
    ]);
  });

  test("prepareSnapshotForUpload redacts before upload by default", () => {
    const result = prepareSnapshotForUpload(
      {
        id: "AbC234xy",
        url: "https://example.com?token=secret",
        network: [
          {
            id: 1,
            method: "GET",
            url: "https://example.com/api?api_key=secret",
            status: 200,
            time: 5,
            requestHeaders: { Authorization: "Bearer secret" },
            responseHeaders: {},
            requestBody: null,
            responseBody: "x".repeat(20_000),
          },
        ],
        cdp: {
          screenshotDataUrl: `data:image/png;base64,${"a".repeat(20_000)}`,
        },
      },
      { maxBytes: 8_000 }
    );

    const serialized = JSON.stringify(result.snapshot);

    expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(8_000);
    expect(serialized).not.toContain("Bearer secret");
    expect(serialized).not.toContain("api_key=secret");
    expect(result.snapshot.redactions.length).toBeGreaterThan(0);
  });

  test("prepareSnapshotForUpload can include screenshots without including other sensitive fields", () => {
    const result = prepareSnapshotForUpload(
      {
        id: "AbC234xy",
        url: "https://example.com?token=secret",
        network: [
          {
            id: 1,
            method: "POST",
            url: "https://example.com/api?api_key=secret",
            status: 200,
            time: 5,
            requestHeaders: { Authorization: "Bearer secret" },
            responseHeaders: {},
            requestBody: "secret body",
            responseBody: "secret response",
          },
        ],
        cdp: {
          screenshotDataUrl: "data:image/png;base64,screenshot-image",
          domSnapshot: { strings: ["password=dom-secret"] },
        },
      },
      { includeScreenshot: true, maxBytes: 8_000 }
    );

    const serialized = JSON.stringify(result.snapshot);

    expect(result.snapshot.cdp.screenshotDataUrl).toBe("data:image/png;base64,screenshot-image");
    expect(serialized).not.toContain("Bearer secret");
    expect(serialized).not.toContain("api_key=secret");
    expect(serialized).not.toContain("secret body");
    expect(serialized).not.toContain("secret response");
    expect(serialized).not.toContain("dom-secret");
  });

  test("prepareSnapshotForUpload trims oversized raw-sensitive payloads", () => {
    const result = prepareSnapshotForUpload(
      {
        id: "AbC234xy",
        url: "https://example.com",
        cdp: {
          screenshotDataUrl: `data:image/png;base64,${"a".repeat(20_000)}`,
        },
      },
      { includeSensitive: true, maxBytes: 8_000 }
    );

    expect(Buffer.byteLength(JSON.stringify(result.snapshot), "utf8")).toBeLessThanOrEqual(8_000);
    expect(result.snapshot.truncations.length).toBeGreaterThan(0);
  });
});
