import { describe, expect, test } from "bun:test";
import { normalizePanelConsoleEntry, panelPathForUrl } from "../../src/panel-format";

describe("panel formatting", () => {
  test("renders malformed network URLs without throwing", () => {
    expect(panelPathForUrl("https://x.com/home")).toBe("/home");
    expect(panelPathForUrl("")).toBe("(unknown)");
    expect(panelPathForUrl("not a url")).toBe("not a url");
  });

  test("normalizes malformed console entries before rendering", () => {
    expect(
      normalizePanelConsoleEntry({
        id: 1,
        type: "debug",
        text: undefined,
        timestamp: 10,
        source: "content",
      })
    ).toMatchObject({
      type: "debug",
      text: "",
      timestamp: 10,
      source: "content",
    });
  });
});
