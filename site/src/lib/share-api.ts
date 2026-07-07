import { UAParser } from "ua-parser-js";
import {
  SNAPSHOT_SCHEMA_VERSION,
  SHARE_APP_URL_BLOCK_MESSAGE,
  buildShareId,
  byteLength,
  isShareAppUrl,
  isValidShareId,
  redactSnapshot,
  trimSnapshotToBytes,
  validateSnapshot,
  type ShareSnapshot,
} from "../../../shared/snapshot";
import { applyShareReadCacheHeaders } from "./share-cache";

export interface ShareApiEnv {
  SNAPSHOTS: R2Bucket;
  SHARE_CREATE_LIMITER?: RateLimit;
  PUBLIC_BASE_URL?: string;
}

export interface ShareRequestContext {
  now?: Date;
  idFactory?: () => string;
  maxBytes?: number;
  cf?: IncomingRequestCfProperties;
  userAgent?: string | null;
}

export interface ShareReadContext {
  now?: Date;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS, GET",
  "access-control-allow-headers": "content-type, x-devtools-export-schema, x-devtools-export-include-sensitive, x-devtools-export-include-screenshot",
  "access-control-max-age": "86400",
};

export function handleCorsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function handleCreateShare(
  request: Request,
  env: ShareApiEnv,
  context: ShareRequestContext = {}
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Expected application/json" }, 415);
  }

  const maxBytes = context.maxBytes ?? DEFAULT_MAX_BYTES;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return json({ error: `Snapshot exceeds ${maxBytes} bytes` }, 413);
  }

  if (!(await canCreateShare(request, env))) {
    return json({ error: "Too many share uploads. Try again shortly." }, 429, { "Retry-After": "60" });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const validation = validateSnapshot(payload);
  if (!validation.ok) {
    return json({ error: "Invalid snapshot", details: validation.errors }, 400);
  }

  const snapshot = payload as ShareSnapshot;
  if (isShareAppUrl(snapshot.page.url)) {
    return json({ error: SHARE_APP_URL_BLOCK_MESSAGE }, 400);
  }

  const now = context.now ?? new Date();
  const expiresAt = new Date(now.getTime() + THIRTY_DAYS_MS).toISOString();
  const id = context.idFactory?.() ?? buildShareId();
  if (!isValidShareId(id)) {
    return json({ error: "Generated invalid share id" }, 500);
  }

  const enriched = enrichSnapshot(snapshot, {
    id,
    now,
    expiresAt,
    cf: context.cf,
    userAgent: context.userAgent ?? request.headers.get("user-agent"),
  });
  const includeSensitive = request.headers.get("x-devtools-export-include-sensitive") === "true";
  const includeScreenshot = request.headers.get("x-devtools-export-include-screenshot") === "true";
  const redacted = redactSnapshot(enriched, { includeSensitive, includeScreenshot }).snapshot;

  let trimmed: ShareSnapshot;
  try {
    trimmed = trimSnapshotToBytes(redacted, maxBytes).snapshot;
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Snapshot too large" }, 413);
  }

  const body = JSON.stringify(trimmed);
  await env.SNAPSHOTS.put(snapshotKey(id), body, {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
    customMetadata: {
      id,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      createdAt: trimmed.createdAt,
      expiresAt,
      bytes: String(byteLength(trimmed)),
    },
  });

  const baseUrl = normalizeBaseUrl(env.PUBLIC_BASE_URL);
  return json(
    {
      id,
      url: `${baseUrl}/share/${id}/`,
      expiresAt,
    },
    201
  );
}

export async function getSharedSnapshotJson(
  id: string,
  env: ShareApiEnv,
  context: ShareReadContext = {}
): Promise<Response> {
  if (!isValidShareId(id)) {
    return json({ error: "Invalid share id" }, 400);
  }

  const object = await env.SNAPSHOTS.get(snapshotKey(id));
  if (!object) {
    return json({ error: "Snapshot not found" }, 404);
  }

  const expiresAt = object.customMetadata?.expiresAt;
  if (expiresAt && new Date(expiresAt).getTime() <= (context.now ?? new Date()).getTime()) {
    return json({ error: "Snapshot expired" }, 410);
  }

  const headers = new Headers(CORS_HEADERS);
  headers.set("content-type", "application/json; charset=utf-8");
  applyShareReadCacheHeaders(headers, expiresAt, context.now ?? new Date());

  return new Response(await object.text(), {
    status: 200,
    headers,
  });
}

export async function loadSharedSnapshot(id: string, env: ShareApiEnv): Promise<ShareSnapshot | null> {
  const response = await getSharedSnapshotJson(id, env);
  if (!response.ok) return null;
  return (await response.json()) as ShareSnapshot;
}

export function snapshotKey(id: string): string {
  return `snapshots/${id}.json`;
}

function enrichSnapshot(
  snapshot: ShareSnapshot,
  input: {
    id: string;
    now: Date;
    expiresAt: string;
    cf?: IncomingRequestCfProperties;
    userAgent?: string | null;
  }
): ShareSnapshot {
  const userAgent = snapshot.environment.userAgent ?? input.userAgent ?? "";
  const parser = new UAParser(userAgent);

  return {
    ...snapshot,
    id: input.id,
    createdAt: input.now.toISOString(),
    expiresAt: input.expiresAt,
    environment: {
      ...snapshot.environment,
      userAgent: userAgent || snapshot.environment.userAgent,
      browser: parser.getResult() as unknown as Record<string, unknown>,
      cloudflare: normalizeCf(input.cf),
    },
  };
}

function normalizeCf(cf: IncomingRequestCfProperties | undefined): Record<string, unknown> {
  if (!cf) {
    return {
      country: "unknown",
      colo: "unknown",
      timezone: "unknown",
    };
  }

  return {
    colo: cf.colo,
    country: cf.country,
    city: cf.city,
    continent: cf.continent,
    latitude: cf.latitude,
    longitude: cf.longitude,
    postalCode: cf.postalCode,
    metroCode: cf.metroCode,
    region: cf.region,
    regionCode: cf.regionCode,
    timezone: cf.timezone,
  };
}

function normalizeBaseUrl(value: string | undefined): string {
  return (value || "https://devtoolsexport.com").replace(/\/+$/, "");
}

async function canCreateShare(request: Request, env: ShareApiEnv): Promise<boolean> {
  if (!env.SHARE_CREATE_LIMITER) return true;

  try {
    const outcome = await env.SHARE_CREATE_LIMITER.limit({ key: shareCreateRateLimitKey(request) });
    return outcome.success;
  } catch (error) {
    console.warn("Share create rate limiter failed", error);
    return true;
  }
}

function shareCreateRateLimitKey(request: Request): string {
  const ip = firstForwardedIp(request.headers.get("cf-connecting-ip")) ?? firstForwardedIp(request.headers.get("x-forwarded-for"));
  if (ip) return `share-create:${ip}`;

  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
  return `share-create:${cf?.country ?? "unknown"}:${cf?.colo ?? "unknown"}`;
}

function firstForwardedIp(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

function json(value: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS_HEADERS,
      ...headers,
    },
  });
}
