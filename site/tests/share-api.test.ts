import { describe, expect, test } from "bun:test";
import { createSnapshot } from "../../shared/snapshot";
import {
  getSharedSnapshotJson,
  handleCorsPreflight,
  handleCreateShare,
  type ShareApiEnv,
} from "../src/lib/share-api";

class MockR2Bucket {
  objects = new Map<string, { body: string; customMetadata?: Record<string, string> }>();

  async put(key: string, value: string, options?: { customMetadata?: Record<string, string> }) {
    this.objects.set(key, { body: value, customMetadata: options?.customMetadata });
    return {} as R2Object;
  }

  async get(key: string) {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      customMetadata: object.customMetadata,
      async text() {
        return object.body;
      },
    } as R2ObjectBody;
  }
}

function makeEnv(bucket = new MockR2Bucket()): ShareApiEnv {
  return {
    SNAPSHOTS: bucket as unknown as R2Bucket,
    PUBLIC_BASE_URL: "https://devtoolsexport.com",
  };
}

describe("share API", () => {
  test("handleCreateShare validates, redacts, trims, stores snapshot, and returns a share URL", async () => {
    const bucket = new MockR2Bucket();
    const request = new Request("https://devtoolsexport.com/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        createSnapshot({
          id: "Temp234x",
          url: "https://example.com/app?token=secret",
          network: [
            {
              id: 1,
              method: "GET",
              url: "https://example.com/api?api_key=secret",
              status: 200,
              time: 20,
              requestHeaders: { Authorization: "Bearer secret" },
              responseHeaders: {},
              requestBody: null,
              responseBody: "x".repeat(20_000),
            },
          ],
        })
      ),
    });

    const response = await handleCreateShare(request, makeEnv(bucket), {
      now: new Date("2026-07-06T12:00:00.000Z"),
      idFactory: () => "AbC234xy",
      maxBytes: 8_000,
    });
    const body = (await response.json()) as { id: string; url: string; expiresAt: string };

    expect(response.status).toBe(201);
    expect(body).toEqual({
      id: "AbC234xy",
      url: "https://devtoolsexport.com/share/AbC234xy/",
      expiresAt: "2026-08-05T12:00:00.000Z",
    });

    const stored = bucket.objects.get("snapshots/AbC234xy.json");
    expect(stored).toBeDefined();
    expect(stored?.customMetadata?.expiresAt).toBe("2026-08-05T12:00:00.000Z");
    expect(stored?.body).not.toContain("Bearer secret");
    expect(stored?.body).not.toContain("api_key=secret");
    expect(Buffer.byteLength(stored?.body ?? "", "utf8")).toBeLessThanOrEqual(8_000);
  });

  test("handleCreateShare rejects non-json requests", async () => {
    const response = await handleCreateShare(
      new Request("https://devtoolsexport.com/api/share", { method: "POST", body: "nope" }),
      makeEnv()
    );

    expect(response.status).toBe(415);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("handleCreateShare rejects oversized content-length before parsing", async () => {
    const response = await handleCreateShare(
      new Request("https://devtoolsexport.com/api/share", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "9000",
        },
        body: "{}",
      }),
      makeEnv(),
      { maxBytes: 8_000 }
    );

    expect(response.status).toBe(413);
  });

  test("handleCreateShare preserves sensitive fields only when explicitly requested", async () => {
    const bucket = new MockR2Bucket();
    const request = new Request("https://devtoolsexport.com/api/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-devtools-export-include-sensitive": "true",
      },
      body: JSON.stringify(
        createSnapshot({
          id: "Temp234x",
          url: "https://example.com/app?token=secret",
          network: [
            {
              id: 1,
              method: "GET",
              url: "https://example.com/api?api_key=secret",
              status: 200,
              time: 20,
              requestHeaders: { Authorization: "Bearer secret" },
              responseHeaders: {},
              requestBody: null,
              responseBody: "ok",
            },
          ],
        })
      ),
    });

    const response = await handleCreateShare(request, makeEnv(bucket), {
      now: new Date("2026-07-06T12:00:00.000Z"),
      idFactory: () => "AbC234xy",
    });

    expect(response.status).toBe(201);
    const stored = bucket.objects.get("snapshots/AbC234xy.json");
    expect(stored?.body).toContain("Bearer secret");
    expect(stored?.body).toContain("api_key=secret");
  });

  test("handleCreateShare parses browser details from captured page user agent before upload user agent", async () => {
    const bucket = new MockR2Bucket();
    const request = new Request("https://devtoolsexport.com/api/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 Firefox/140.0",
      },
      body: JSON.stringify(
        createSnapshot({
          id: "Temp234x",
          url: "https://example.com/app",
          environment: {
            userAgent:
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          },
        })
      ),
    });

    const response = await handleCreateShare(request, makeEnv(bucket), {
      now: new Date("2026-07-06T12:00:00.000Z"),
      idFactory: () => "AbC234xy",
    });

    expect(response.status).toBe(201);
    const stored = JSON.parse(bucket.objects.get("snapshots/AbC234xy.json")?.body ?? "{}") as {
      environment?: { userAgent?: string; browser?: { browser?: { name?: string } } };
    };
    expect(stored.environment?.userAgent).toContain("Chrome/126.0.0.0");
    expect(stored.environment?.browser?.browser?.name).toBe("Chrome");
  });

  test("handleCreateShare can preserve screenshots without preserving other sensitive fields", async () => {
    const bucket = new MockR2Bucket();
    const request = new Request("https://devtoolsexport.com/api/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-devtools-export-include-screenshot": "true",
      },
      body: JSON.stringify(
        createSnapshot({
          id: "Temp234x",
          url: "https://example.com/app?token=secret",
          network: [
            {
              id: 1,
              method: "GET",
              url: "https://example.com/api?api_key=secret",
              status: 200,
              time: 20,
              requestHeaders: { Authorization: "Bearer secret" },
              responseHeaders: {},
              requestBody: null,
              responseBody: "ok",
            },
          ],
          cdp: {
            screenshotDataUrl: "data:image/png;base64,screenshot-image",
            domSnapshot: { strings: ["password=dom-secret"] },
          },
        })
      ),
    });

    const response = await handleCreateShare(request, makeEnv(bucket), {
      now: new Date("2026-07-06T12:00:00.000Z"),
      idFactory: () => "AbC234xy",
    });

    expect(response.status).toBe(201);
    const stored = bucket.objects.get("snapshots/AbC234xy.json");
    expect(stored?.body).toContain("screenshot-image");
    expect(stored?.body).not.toContain("Bearer secret");
    expect(stored?.body).not.toContain("api_key=secret");
    expect(stored?.body).not.toContain("dom-secret");
  });

  test("handleCorsPreflight allows extension upload headers", () => {
    const response = handleCorsPreflight();

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(response.headers.get("access-control-allow-headers")).toContain("content-type");
    expect(response.headers.get("access-control-allow-headers")).toContain("x-devtools-export-include-sensitive");
    expect(response.headers.get("access-control-allow-headers")).toContain("x-devtools-export-include-screenshot");
  });

  test("getSharedSnapshotJson returns stored JSON with no-store cache headers", async () => {
    const bucket = new MockR2Bucket();
    const snapshot = createSnapshot({ id: "AbC234xy", url: "https://example.com" });
    await bucket.put("snapshots/AbC234xy.json", JSON.stringify(snapshot), {
      customMetadata: { expiresAt: "2026-08-05T12:00:00.000Z" },
    });

    const response = await getSharedSnapshotJson("AbC234xy", makeEnv(bucket));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).id).toBe("AbC234xy");
  });

  test("getSharedSnapshotJson returns 410 for expired objects even if R2 has not deleted them", async () => {
    const bucket = new MockR2Bucket();
    const snapshot = createSnapshot({ id: "AbC234xy", url: "https://example.com" });
    await bucket.put("snapshots/AbC234xy.json", JSON.stringify(snapshot), {
      customMetadata: { expiresAt: "2026-07-01T12:00:00.000Z" },
    });

    const response = await getSharedSnapshotJson("AbC234xy", makeEnv(bucket), {
      now: new Date("2026-07-06T12:00:00.000Z"),
    });

    expect(response.status).toBe(410);
  });

  test("getSharedSnapshotJson rejects invalid ids and missing snapshots", async () => {
    expect((await getSharedSnapshotJson("bad", makeEnv())).status).toBe(400);
    expect((await getSharedSnapshotJson("AbC234xy", makeEnv())).status).toBe(404);
  });
});
