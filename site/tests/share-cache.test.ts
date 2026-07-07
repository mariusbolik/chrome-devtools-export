import { describe, expect, test } from "bun:test";
import {
  SHARE_READ_EDGE_CACHE_SECONDS,
  cacheableShareReadResponse,
  shareReadCacheControl,
  shareReadCacheRequest,
} from "../src/lib/share-cache";

describe("share read cache", () => {
  test("builds a normalized cache key for public share reads only", () => {
    expect(shareReadCacheRequest(new Request("https://devtoolsexport.com/share/AbC234xy/?tab=network"))?.url).toBe(
      "https://devtoolsexport.com/share/AbC234xy/"
    );
    expect(shareReadCacheRequest(new Request("https://devtoolsexport.com/api/share/AbC234xy.json?download=1"))?.url).toBe(
      "https://devtoolsexport.com/api/share/AbC234xy.json"
    );
    expect(shareReadCacheRequest(new Request("https://devtoolsexport.com/api/share", { method: "POST" }))).toBeNull();
    expect(shareReadCacheRequest(new Request("https://devtoolsexport.com/favicon.svg"))).toBeNull();
  });

  test("caps edge cache ttl by the snapshot expiry", () => {
    const now = new Date("2026-07-06T12:00:00.000Z");

    expect(shareReadCacheControl("2026-07-06T12:03:00.000Z", now)).toEqual({
      browser: "public, max-age=0, s-maxage=180",
      cdn: "max-age=180",
      seconds: 180,
    });
    expect(shareReadCacheControl("2026-07-06T13:00:00.000Z", now)).toEqual({
      browser: `public, max-age=0, s-maxage=${SHARE_READ_EDGE_CACHE_SECONDS}`,
      cdn: `max-age=${SHARE_READ_EDGE_CACHE_SECONDS}`,
      seconds: SHARE_READ_EDGE_CACHE_SECONDS,
    });
    expect(shareReadCacheControl("2026-07-06T11:59:00.000Z", now)).toBeNull();
  });

  test("only caches successful public responses without cookies or no-store", () => {
    const ok = new Response("{}", {
      status: 200,
      headers: { "cache-control": "public, max-age=0, s-maxage=300" },
    });

    expect(cacheableShareReadResponse(ok)).toBe(true);
    expect(cacheableShareReadResponse(new Response("missing", { status: 404 }))).toBe(false);
    expect(cacheableShareReadResponse(new Response("{}", { status: 200, headers: { "set-cookie": "id=1" } }))).toBe(false);
    expect(cacheableShareReadResponse(new Response("{}", { status: 200, headers: { "cache-control": "no-store" } }))).toBe(false);
  });
});
