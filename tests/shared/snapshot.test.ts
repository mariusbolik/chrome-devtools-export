import { describe, expect, test } from "bun:test";
import {
  REDACTED_VALUE,
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

  test("redactSnapshot redacts duplicated URL fields, console metadata, and fingerprint-heavy details by default", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com/app",
      environment: {
        cloudflare: {
          country: "DE",
          colo: "FRA",
          city: "Berlin",
          region: "Berlin",
          postalCode: "10115",
          latitude: "52.5200",
          longitude: "13.4050",
          timezone: "Europe/Berlin",
        },
      },
      installedExtensions: [
        {
          id: "abcdefghijklmnopabcdefghijklmnop",
          name: "React DevTools",
          version: "5.0.0",
          enabled: true,
          type: "extension",
          installType: "normal",
          permissions: ["storage", "tabs"],
          hostPermissions: ["https://secret.example.com/*"],
        },
      ],
      console: [
        {
          id: 1,
          type: "error",
          text: "Failed to load https://api.example.com/user?token=console-token",
          timestamp: 1,
          source: "content",
          frameUrl: "https://app.example.com/page?session=frame-secret",
          args: [{ requestUrl: "https://api.example.com/users?api_key=args-secret", visible: "keep me" }],
          stackTrace: {
            callFrames: [
              { url: "https://cdn.example.com/app.js?jwt=stack-secret", functionName: "load" },
            ],
          },
        },
      ],
      cdp: {
        pageAssets: {
          images: ["https://cdn.example.com/logo.png?token=asset-secret"],
          scripts: ["https://cdn.example.com/app.js?api_key=script-secret"],
          stylesheets: ["https://cdn.example.com/app.css?sid=style-secret"],
        },
        pageResources: [
          {
            name: "https://api.example.com/users?access_token=resource-secret",
            initiatorType: "fetch",
            duration: 42,
          },
        ],
      },
    });

    const result = redactSnapshot(snapshot);
    const serialized = JSON.stringify(result.snapshot);

    expect(serialized).not.toContain("console-token");
    expect(serialized).not.toContain("frame-secret");
    expect(serialized).not.toContain("args-secret");
    expect(serialized).not.toContain("stack-secret");
    expect(serialized).not.toContain("asset-secret");
    expect(serialized).not.toContain("script-secret");
    expect(serialized).not.toContain("style-secret");
    expect(serialized).not.toContain("resource-secret");
    expect(serialized).not.toContain("abcdefghijklmnopabcdefghijklmnop");
    expect(serialized).not.toContain("5.0.0");
    expect(serialized).not.toContain("https://secret.example.com/*");
    expect(serialized).not.toContain("Berlin");
    expect(serialized).not.toContain("10115");
    expect(serialized).not.toContain("52.5200");
    expect(serialized).not.toContain("13.4050");
    expect(result.snapshot.environment.cloudflare).toEqual({ country: "DE", colo: "FRA" });
    expect(result.snapshot.installedExtensions).toEqual([
      {
        name: "React DevTools",
        enabled: true,
        type: "extension",
      },
    ]);
    expect(result.snapshot.console[0].args).toEqual([
      { requestUrl: "https://api.example.com/users?api_key=%5BREDACTED%5D", visible: "keep me" },
    ]);
  });

  test("redactSnapshot preserves useful structured body content while redacting sensitive values", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com/app",
      network: [
        {
          id: 1,
          method: "POST",
          url: "https://api.example.com/users",
          status: 201,
          time: 44,
          requestHeaders: {
            Authorization: "Bearer request-header-secret",
            Cookie: "sid=session-secret; theme=dark",
            "Content-Type": "application/json",
          },
          responseHeaders: {
            "set-cookie": "refresh_token=response-cookie-secret; Path=/; HttpOnly",
            "Content-Type": "application/json",
          },
          requestBody: JSON.stringify({
            email: "user@example.com",
            plan: "pro",
            password: "body-password-secret",
            profile: {
              name: "Marius",
              refresh_token: "nested-refresh-secret",
            },
          }),
          responseBody: "ok=true&token=response-token-secret&message=created",
        },
      ],
      storage: {
        localStorage: {
          settings: JSON.stringify({ theme: "dark", access_token: "stored-token-secret" }),
        },
        sessionStorage: {},
        cookies: {
          sid: "storage-cookie-secret",
        },
        indexedDB: {},
      },
      cdp: {
        cookies: [
          {
            name: "sid",
            value: "cdp-cookie-secret",
            domain: "example.com",
            httpOnly: true,
          },
        ],
      },
    });

    const result = redactSnapshot(snapshot);
    const [request] = result.snapshot.network;
    const serialized = JSON.stringify(result.snapshot);

    expect(request.requestHeaders.Authorization).toBe(`Bearer ${REDACTED_VALUE}`);
    expect(request.requestHeaders.Cookie).toBe(`sid=${REDACTED_VALUE}; theme=${REDACTED_VALUE}`);
    expect(request.responseHeaders["set-cookie"]).toBe(`refresh_token=${REDACTED_VALUE}; Path=/; HttpOnly`);
    expect(request.requestBody).not.toBe(REDACTED_VALUE);
    expect(request.requestBody).toContain('"email": "user@example.com"');
    expect(request.requestBody).toContain('"plan": "pro"');
    expect(request.requestBody).toContain('"name": "Marius"');
    expect(request.responseBody).toBe(`ok=true&token=${encodeURIComponent(REDACTED_VALUE)}&message=created`);
    expect(result.snapshot.storage.localStorage.settings).toContain('"theme": "dark"');
    expect(result.snapshot.storage.localStorage.settings).toContain(`"access_token": "${REDACTED_VALUE}"`);
    expect(result.snapshot.storage.cookies.sid).toBe(REDACTED_VALUE);
    expect(result.snapshot.cdp.cookies).toEqual([
      {
        name: "sid",
        value: REDACTED_VALUE,
        domain: "example.com",
        httpOnly: true,
      },
    ]);

    expect(serialized).not.toContain("request-header-secret");
    expect(serialized).not.toContain("session-secret");
    expect(serialized).not.toContain("response-cookie-secret");
    expect(serialized).not.toContain("body-password-secret");
    expect(serialized).not.toContain("nested-refresh-secret");
    expect(serialized).not.toContain("response-token-secret");
    expect(serialized).not.toContain("stored-token-secret");
    expect(serialized).not.toContain("storage-cookie-secret");
    expect(serialized).not.toContain("cdp-cookie-secret");
  });

  test("redactSnapshot omits binary-like bodies instead of storing unsafe raw content", () => {
    const snapshot = createSnapshot({
      id: "AbC234xy",
      url: "https://example.com/app",
      network: [
        {
          id: 1,
          method: "GET",
          url: "https://example.com/image",
          status: 200,
          time: 12,
          requestHeaders: {},
          responseHeaders: { "Content-Type": "image/png" },
          requestBody: null,
          responseBody: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
        },
      ],
    });

    const result = redactSnapshot(snapshot);

    expect(result.snapshot.network[0].responseBody).toBe("[BINARY body omitted]");
    expect(result.redactions).toContainEqual({
      path: "network[0].responseBody",
      reason: "Binary body omitted",
    });
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
          responseBody: "token=secret-body&status=ok",
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
