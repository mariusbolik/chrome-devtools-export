import { describe, expect, test } from "bun:test";
import { trailingSlashRedirectTarget } from "../src/lib/trailing-slash";

describe("trailing slash redirects", () => {
  test("redirects app page paths to a trailing slash", () => {
    expect(trailingSlashRedirectTarget(new URL("https://devtoolsexport.com/share/AbC234xy"))).toBe("https://devtoolsexport.com/share/AbC234xy/");
    expect(trailingSlashRedirectTarget(new URL("https://devtoolsexport.com/share/AbC234xy?tab=network"))).toBe(
      "https://devtoolsexport.com/share/AbC234xy/?tab=network"
    );
  });

  test("does not redirect existing slash paths, APIs, or static files", () => {
    expect(trailingSlashRedirectTarget(new URL("https://devtoolsexport.com/"))).toBeNull();
    expect(trailingSlashRedirectTarget(new URL("https://devtoolsexport.com/share/AbC234xy/"))).toBeNull();
    expect(trailingSlashRedirectTarget(new URL("https://devtoolsexport.com/api/health"))).toBeNull();
    expect(trailingSlashRedirectTarget(new URL("https://devtoolsexport.com/api/share/AbC234xy.json"))).toBeNull();
    expect(trailingSlashRedirectTarget(new URL("https://devtoolsexport.com/_astro/index.D4Ft5j-y.css"))).toBeNull();
    expect(trailingSlashRedirectTarget(new URL("https://devtoolsexport.com/favicon-96x96.png"))).toBeNull();
    expect(trailingSlashRedirectTarget(new URL("https://devtoolsexport.com/app.js"))).toBeNull();
  });
});
