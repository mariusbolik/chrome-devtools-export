import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const wranglerConfig = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");

describe("wrangler config", () => {
  test("routes production traffic through the custom domain only", () => {
    expect(wranglerConfig).toContain('workers_dev = false');
    expect(wranglerConfig).toContain('PUBLIC_BASE_URL = "https://devtoolsexport.com"');
    expect(wranglerConfig).toMatch(/\[\[routes\]\]\s+pattern = "devtoolsexport\.com"\s+custom_domain = true/);
  });

  test("uses the remote R2 bucket for local development", () => {
    expect(wranglerConfig).toMatch(/\[\[r2_buckets\]\]\s+binding = "SNAPSHOTS"\s+bucket_name = "devtools-export-shares"\s+remote = true/);
  });
});
