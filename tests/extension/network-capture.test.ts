import { describe, expect, test } from "bun:test";
import {
  createNetworkCaptureStore,
  getCapturedNetworkRequests,
  recordBeforeRequest,
  recordCompleted,
  recordErrorOccurred,
  recordHeadersReceived,
  recordPageNetworkEntry,
  recordSendHeaders,
} from "../../src/network-capture";

const encoder = new TextEncoder();

describe("network capture store", () => {
  test("merges webRequest lifecycle events into a useful snapshot row", () => {
    const store = createNetworkCaptureStore(10);

    recordBeforeRequest(store, {
      tabId: 4,
      requestId: "req-1",
      method: "POST",
      url: "https://example.com/api/users",
      type: "xmlhttprequest",
      timeStamp: 1000,
      requestBody: {
        raw: [{ bytes: encoder.encode(JSON.stringify({ email: "user@example.com" })).buffer }],
      },
    });
    recordSendHeaders(store, {
      tabId: 4,
      requestId: "req-1",
      method: "POST",
      url: "https://example.com/api/users",
      type: "xmlhttprequest",
      timeStamp: 1010,
      requestHeaders: [{ name: "content-type", value: "application/json" }],
    });
    recordHeadersReceived(store, {
      tabId: 4,
      requestId: "req-1",
      method: "POST",
      url: "https://example.com/api/users",
      type: "xmlhttprequest",
      timeStamp: 1150,
      statusCode: 201,
      statusLine: "HTTP/2 201",
      responseHeaders: [{ name: "content-type", value: "application/json" }],
    });
    recordCompleted(store, {
      tabId: 4,
      requestId: "req-1",
      method: "POST",
      url: "https://example.com/api/users",
      type: "xmlhttprequest",
      timeStamp: 1250,
      statusCode: 201,
      statusLine: "HTTP/2 201",
      responseHeaders: [],
      fromCache: false,
    });

    expect(getCapturedNetworkRequests(store, 4)).toEqual([
      {
        id: 1,
        method: "POST",
        url: "https://example.com/api/users",
        status: 201,
        time: 250,
        source: "web-request",
        initiatorType: "xmlhttprequest",
        requestHeaders: { "content-type": "application/json" },
        responseHeaders: { "content-type": "application/json" },
        requestBody: '{"email":"user@example.com"}',
        responseBody: null,
      },
    ]);
  });

  test("merges page-intercept bodies with webRequest metadata for the same request", () => {
    const store = createNetworkCaptureStore(10);

    recordBeforeRequest(store, {
      tabId: 4,
      requestId: "req-1",
      method: "PATCH",
      url: "https://example.com/api/settings",
      type: "fetch",
      timeStamp: 1000,
      requestBody: null,
    });
    recordSendHeaders(store, {
      tabId: 4,
      requestId: "req-1",
      method: "PATCH",
      url: "https://example.com/api/settings",
      type: "fetch",
      timeStamp: 1010,
      requestHeaders: [{ name: "x-request-id", value: "abc" }],
    });
    recordHeadersReceived(store, {
      tabId: 4,
      requestId: "req-1",
      method: "PATCH",
      url: "https://example.com/api/settings",
      type: "fetch",
      timeStamp: 1100,
      statusCode: 200,
      statusLine: "HTTP/2 200",
      responseHeaders: [{ name: "content-type", value: "application/json" }],
    });
    recordPageNetworkEntry(store, 4, {
      method: "PATCH",
      url: "https://example.com/api/settings",
      status: 200,
      time: 130,
      timestamp: 1005,
      requestBody: '{"theme":"dark"}',
      responseBody: '{"ok":true}',
      responseHeaders: { "content-type": "application/json; charset=utf-8" },
    });

    expect(getCapturedNetworkRequests(store, 4)).toEqual([
      {
        id: 1,
        method: "PATCH",
        url: "https://example.com/api/settings",
        status: 200,
        time: 130,
        source: "page-intercept",
        initiatorType: "fetch",
        requestHeaders: { "x-request-id": "abc" },
        responseHeaders: { "content-type": "application/json; charset=utf-8" },
        requestBody: '{"theme":"dark"}',
        responseBody: '{"ok":true}',
      },
    ]);
  });

  test("keeps a bounded per-tab buffer and records failed requests", () => {
    const store = createNetworkCaptureStore(2);

    for (let index = 0; index < 3; index += 1) {
      recordBeforeRequest(store, {
        tabId: 7,
        requestId: `req-${index}`,
        method: "GET",
        url: `https://example.com/${index}`,
        type: "script",
        timeStamp: 1000 + index,
        requestBody: null,
      });
      if (index === 2) {
        recordErrorOccurred(store, {
          tabId: 7,
          requestId: "req-2",
          method: "GET",
          url: "https://example.com/2",
          type: "script",
          timeStamp: 1300,
          statusCode: 0,
          statusLine: "",
          responseHeaders: [],
          fromCache: false,
          error: "net::ERR_BLOCKED_BY_CLIENT",
        });
      }
    }

    expect(getCapturedNetworkRequests(store, 7).map((request) => [request.url, request.status, request.time, request.error])).toEqual([
      ["https://example.com/1", 0, 0, undefined],
      ["https://example.com/2", 0, 298, "net::ERR_BLOCKED_BY_CLIENT"],
    ]);
  });

  test("merges failed fetch net errors with the page call stack", () => {
    const store = createNetworkCaptureStore(10);

    recordBeforeRequest(store, {
      tabId: 9,
      requestId: "viewer-context",
      method: "POST",
      url: "https://x.com/i/api/1.1/graphql/viewer_context.json",
      type: "xmlhttprequest",
      timeStamp: 2000,
      requestBody: null,
    });
    recordPageNetworkEntry(store, 9, {
      method: "POST",
      url: "https://x.com/i/api/1.1/graphql/viewer_context.json",
      status: 0,
      time: 50,
      timestamp: 2010,
      initiatorType: "fetch",
      requestBody: null,
      responseBody: null,
      stackTrace: "Error\n    at dispatch (https://x.com/main.js:16:1)\n    at post (https://x.com/main.js:17:1)",
    });
    recordErrorOccurred(store, {
      tabId: 9,
      requestId: "viewer-context",
      method: "POST",
      url: "https://x.com/i/api/1.1/graphql/viewer_context.json",
      type: "xmlhttprequest",
      timeStamp: 2075,
      statusCode: 0,
      statusLine: "",
      responseHeaders: [],
      fromCache: false,
      error: "net::ERR_BLOCKED_BY_CLIENT",
    });

    expect(getCapturedNetworkRequests(store, 9)).toEqual([
      expect.objectContaining({
        method: "POST",
        url: "https://x.com/i/api/1.1/graphql/viewer_context.json",
        status: 0,
        error: "net::ERR_BLOCKED_BY_CLIENT",
        stackTrace: "Error\n    at dispatch (https://x.com/main.js:16:1)\n    at post (https://x.com/main.js:17:1)",
      }),
    ]);
  });
});
