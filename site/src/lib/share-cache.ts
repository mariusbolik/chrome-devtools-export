import { isValidShareId } from "../../../shared/snapshot";

export const SHARE_READ_EDGE_CACHE_SECONDS = 300;

export interface ShareReadCacheControl {
  browser: string;
  cdn: string;
  seconds: number;
}

export function shareReadCacheRequest(request: Request): Request | null {
  if (request.method !== "GET") return null;

  const url = new URL(request.url);
  const id = shareReadId(url.pathname);
  if (!id) return null;

  url.search = "";
  url.hash = "";
  return new Request(url.toString(), { method: "GET" });
}

export function shareReadCacheControl(expiresAt?: string, now = new Date()): ShareReadCacheControl | null {
  let seconds = SHARE_READ_EDGE_CACHE_SECONDS;
  if (expiresAt) {
    const expiryMs = new Date(expiresAt).getTime();
    if (Number.isFinite(expiryMs)) {
      seconds = Math.min(seconds, Math.floor((expiryMs - now.getTime()) / 1000));
    }
  }

  if (seconds <= 0) return null;

  return {
    browser: `public, max-age=0, s-maxage=${seconds}`,
    cdn: `max-age=${seconds}`,
    seconds,
  };
}

export function applyShareReadCacheHeaders(headers: Headers, expiresAt?: string, now = new Date()): boolean {
  const cache = shareReadCacheControl(expiresAt, now);
  if (!cache) {
    headers.set("cache-control", "no-store");
    return false;
  }

  headers.set("cache-control", cache.browser);
  headers.set("cdn-cache-control", cache.cdn);
  return true;
}

export function cacheableShareReadResponse(response: Response): boolean {
  if (response.status !== 200) return false;
  if (response.headers.has("set-cookie")) return false;

  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (!cacheControl || cacheControl.includes("no-store") || cacheControl.includes("private")) return false;

  return true;
}

function shareReadId(pathname: string): string | null {
  const pageMatch = /^\/share\/([^/]+)\/$/.exec(pathname);
  if (pageMatch) return isValidShareId(pageMatch[1]) ? pageMatch[1] : null;

  const jsonMatch = /^\/api\/share\/([^/.]+)\.json$/.exec(pathname);
  if (jsonMatch) return isValidShareId(jsonMatch[1]) ? jsonMatch[1] : null;

  return null;
}
