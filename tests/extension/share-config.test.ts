import { describe, expect, test } from "bun:test";
import { SHARE_ENDPOINT } from "../../src/share-snapshot";

describe("share service config", () => {
  test("uses the renamed workers.dev endpoint", () => {
    expect(SHARE_ENDPOINT).toBe("https://devtools-export.mcb-software.workers.dev/api/share");
  });
});
