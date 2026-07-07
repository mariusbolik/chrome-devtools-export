import { describe, expect, test } from "bun:test";
import type { NetworkRequestSnapshot } from "../../shared/snapshot";
import { networkFailureConsoleText, withNetworkFailureConsoleLogs } from "../../src/network-console";

const failedRequest: NetworkRequestSnapshot = {
  id: 1,
  method: "POST",
  url: "https://x.com/i/api/1.1/graphql/viewer_context.json",
  status: 0,
  time: 75,
  source: "page-intercept",
  initiatorType: "fetch",
  requestHeaders: {},
  responseHeaders: {},
  requestBody: null,
  responseBody: null,
  error: "net::ERR_BLOCKED_BY_CLIENT",
  stackTrace: "Error\n    at dispatch (https://x.com/main.js:16:1)\n    at post (https://x.com/main.js:17:1)",
};

describe("network failure console entries", () => {
  test("formats failed network requests like browser console errors", () => {
    expect(networkFailureConsoleText(failedRequest)).toBe(
      "POST https://x.com/i/api/1.1/graphql/viewer_context.json net::ERR_BLOCKED_BY_CLIENT\n" +
        "    at dispatch (https://x.com/main.js:16:1)\n" +
        "    at post (https://x.com/main.js:17:1)"
    );
  });

  test("adds failed network requests to console logs without duplicating existing rows", () => {
    const existing = {
      id: 1,
      type: "error" as const,
      text: "POST https://x.com/i/api/1.1/graphql/viewer_context.json net::ERR_BLOCKED_BY_CLIENT",
      timestamp: 1,
      source: "content" as const,
    };

    expect(withNetworkFailureConsoleLogs([], [failedRequest], "https://x.com/home")[0]).toEqual(
      expect.objectContaining({
        type: "error",
        text: expect.stringContaining("net::ERR_BLOCKED_BY_CLIENT"),
        frameUrl: "https://x.com/home",
      })
    );
    expect(withNetworkFailureConsoleLogs([existing], [failedRequest], "https://x.com/home")).toEqual([existing]);
  });
});
