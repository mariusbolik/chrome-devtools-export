import { describe, expect, test } from "bun:test";
import {
  SHARE_ID_ALPHABET,
  buildShareId,
  createSnapshot,
  redactSnapshot,
  trimSnapshotToBytes,
  validateSnapshot,
} from "../../shared/snapshot";

describe("shared snapshot utilities", () => {
  test("buildShareId returns an 8-character URL-safe id", () => {
    const id = buildShareId();

    expect(id).toHaveLength(8);
    for (const char of id) {
      expect(SHARE_ID_ALPHABET).toContain(char);
    }
  });

  test("redactSnapshot masks sensitive headers, query params, cookies, and storage values", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com/app?token=secret-token&view=debug",
      referrer: "https://auth.example.com/callback#access_token=fragment-secret&id_token=jwt-secret",
      network: [
        {
          id: 1,
          method: "POST",
          url: "https://api.example.com/users?api_key=abc123",
          status: 401,
          time: 32,
          requestHeaders: {
            Authorization: "Bearer top-secret",
            "Content-Type": "application/json",
          },
          responseHeaders: {
            "set-cookie": "sid=secret; HttpOnly",
          },
          requestBody: JSON.stringify({ password: "secret", email: "a@example.com" }),
          responseBody: JSON.stringify({ token: "secret-response" }),
        },
      ],
      storage: {
        localStorage: { authToken: "abc", theme: "dark" },
        sessionStorage: { refresh_token: "def" },
        cookies: { sid: "secret-cookie" },
        indexedDB: {},
      },
      console: [
        { id: 1, type: "error", text: "Authorization: Bearer console-secret", timestamp: 1, source: "content" },
      ],
      cdp: {
        screenshotDataUrl: "data:image/png;base64,screenshot-secret",
        domSnapshot: { strings: ["password=dom-secret"] },
        cookies: [{ name: "sid", value: "cdp-secret" }],
      },
    });

    const result = redactSnapshot(snapshot);
    const serialized = JSON.stringify(result.snapshot);

    expect(serialized).not.toContain("top-secret");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("fragment-secret");
    expect(serialized).not.toContain("jwt-secret");
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("secret-cookie");
    expect(serialized).not.toContain("console-secret");
    expect(serialized).not.toContain("screenshot-secret");
    expect(serialized).not.toContain("dom-secret");
    expect(serialized).not.toContain("cdp-secret");
    expect(serialized).toContain("[REDACTED]");
    expect(result.redactions.length).toBeGreaterThanOrEqual(12);
  });

  test("redactSnapshot can preserve screenshots without preserving other sensitive fields", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com/app?token=secret-token",
      network: [
        {
          id: 1,
          method: "GET",
          url: "https://api.example.com/users?api_key=abc123",
          status: 200,
          time: 10,
          requestHeaders: { Authorization: "Bearer top-secret" },
          responseHeaders: {},
          requestBody: null,
          responseBody: "secret-body",
        },
      ],
      cdp: {
        screenshotDataUrl: "data:image/png;base64,screenshot-image",
        domSnapshot: { strings: ["password=dom-secret"] },
        cookies: [{ name: "sid", value: "cdp-secret" }],
      },
    });

    const result = redactSnapshot(snapshot, { includeScreenshot: true });
    const serialized = JSON.stringify(result.snapshot);

    expect(result.snapshot.cdp.screenshotDataUrl).toBe("data:image/png;base64,screenshot-image");
    expect(serialized).not.toContain("top-secret");
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("secret-body");
    expect(serialized).not.toContain("dom-secret");
    expect(serialized).not.toContain("cdp-secret");
  });

  test("trimSnapshotToBytes trims large bodies before dropping useful summary data", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com",
      network: [
        {
          id: 1,
          method: "GET",
          url: "https://example.com/large",
          status: 200,
          time: 20,
          requestHeaders: {},
          responseHeaders: {},
          requestBody: null,
          responseBody: "x".repeat(20_000),
        },
      ],
      cdp: {
        screenshotDataUrl: `data:image/png;base64,${"a".repeat(20_000)}`,
        domSnapshot: { strings: ["y".repeat(20_000)] },
      },
    });

    const result = trimSnapshotToBytes(snapshot, 8_000);

    expect(Buffer.byteLength(JSON.stringify(result.snapshot), "utf8")).toBeLessThanOrEqual(8_000);
    expect(result.snapshot.page.url).toBe("https://example.com");
    expect(result.truncations.length).toBeGreaterThan(0);
  });

  test("validateSnapshot accepts v1 snapshots and rejects malformed payloads", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com",
    });

    expect(validateSnapshot(snapshot).ok).toBe(true);
    expect(validateSnapshot({ ...snapshot, schemaVersion: "other" }).ok).toBe(false);
    expect(validateSnapshot({ ...snapshot, id: "too-long-for-v1" }).ok).toBe(false);
    expect(validateSnapshot({ ...snapshot, page: { url: "javascript:alert(1)" } }).ok).toBe(false);
  });
});
