import { describe, expect, test } from "bun:test";
import manifest from "../../manifest.json";
import { SHARE_ENDPOINT } from "../../src/share-snapshot";

describe("share service config", () => {
  test("uses the custom domain endpoint", () => {
    expect(SHARE_ENDPOINT).toBe("https://devtoolsexport.com/api/share");
  });

  test("declares webRequest for richer popup network capture", () => {
    expect(manifest.permissions).toContain("webRequest");
  });

  test("declares scripting so updated content bridge code can reach already-open tabs", () => {
    expect(manifest.permissions).toContain("scripting");
  });
});
