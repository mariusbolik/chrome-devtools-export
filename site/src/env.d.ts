/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

interface Env {
  SNAPSHOTS: R2Bucket;
  SHARE_CREATE_LIMITER?: RateLimit;
  PUBLIC_BASE_URL?: string;
}
