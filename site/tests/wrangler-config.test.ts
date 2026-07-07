import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const wranglerConfig = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const astroConfig = readFileSync(new URL("../astro.config.mjs", import.meta.url), "utf8");

describe("wrangler config", () => {
  test("routes production traffic through the custom domain only", () => {
    expect(wranglerConfig.workers_dev).toBe(false);
    expect(wranglerConfig.vars.PUBLIC_BASE_URL).toBe("https://devtoolsexport.com");
    expect(wranglerConfig.routes).toEqual([
      {
        pattern: "devtoolsexport.com",
        custom_domain: true,
      },
    ]);
  });

  test("uses the remote R2 bucket for local development", () => {
    expect(wranglerConfig.r2_buckets).toEqual([
      {
        binding: "SNAPSHOTS",
        bucket_name: "devtools-export-shares",
        remote: true,
      },
    ]);
  });

  test("rate limits share creation uploads", () => {
    expect(wranglerConfig.ratelimits).toEqual([
      {
        name: "SHARE_CREATE_LIMITER",
        namespace_id: "1001",
        simple: {
          limit: 20,
          period: 60,
        },
      },
    ]);
  });

  test("does not enable Node.js compatibility without a Node API dependency", () => {
    expect(wranglerConfig.compatibility_flags ?? []).not.toContain("nodejs_compat");
  });

  test("disables the automatic Cloudflare SESSION KV binding", () => {
    expect(astroConfig).toContain("sessionDrivers");
    expect(astroConfig).toContain("session:");
    expect(astroConfig).toContain("driver: sessionDrivers.lruCache()");
    expect(wranglerConfig.kv_namespaces ?? []).not.toContainEqual(expect.objectContaining({ binding: "SESSION" }));
  });
});
