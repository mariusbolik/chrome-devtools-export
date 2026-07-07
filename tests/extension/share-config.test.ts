import { describe, expect, test } from "bun:test";
import { SHARE_ENDPOINT } from "../../src/share-snapshot";

describe("share service config", () => {
  test("uses the custom domain endpoint", () => {
    expect(SHARE_ENDPOINT).toBe("https://devtoolsexport.com/api/share");
  });
});
