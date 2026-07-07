(function () {
  "use strict";

  if ((window as unknown as { __DEVTOOLS_EXPORT_LOGGER__?: boolean }).__DEVTOOLS_EXPORT_LOGGER__) {
    return;
  }

  (window as unknown as { __DEVTOOLS_EXPORT_LOGGER__?: boolean }).__DEVTOOLS_EXPORT_LOGGER__ = true;

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };
  const originalFetch = window.fetch;
  const OriginalXMLHttpRequest = window.XMLHttpRequest;
  const BODY_PREVIEW_CHAR_LIMIT = 16_384;

  const safeStringify = (value: unknown, depth = 0): string => {
    if (depth > 8) return "[Max Depth Reached]";

    try {
      if (value === null) return "null";
      if (value === undefined) return "undefined";
      if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
      if (typeof value === "symbol") return value.toString();
      if (value instanceof Date) return value.toString();
      if (value instanceof RegExp) return value.toString();
      if (value instanceof Error) {
        const errorObj = {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
        return JSON.stringify(errorObj).replace(/\n/g, "\n");
      }
      if (Array.isArray(value)) {
        const items = value.map((item) => safeStringify(item, depth + 1)).join(", ");
        return `(${value.length}) [${items}]`;
      }
      if (typeof value === "object") {
        const keys = Object.keys(value as Record<string, unknown>).slice(0, 50);
        const pairs = keys.map((key) => {
          try {
            const record = value as Record<string, unknown>;
            return `"${key}": ${safeStringify(record[key], depth + 1)}`;
          } catch {
            return `"${key}": [Error serializing]`;
          }
        });
        return "{" + pairs.join(", ") + (Object.keys(value as object).length > 50 ? "..." : "") + "}";
      }
      if (typeof value === "number") {
        if (value === Infinity) return "Infinity";
        if (value === -Infinity) return "-Infinity";
        if (Number.isNaN(value)) return "NaN";
      }
      return JSON.stringify(value);
    } catch {
      return "[Circular or Non-Serializable Object]";
    }
  };

  const formatMessage = (args: unknown[]): string => {
    if (args.length === 0) return "";
    const parts: string[] = [];

    for (const arg of args) {
      if (arg instanceof Error) {
        if (arg.stack) {
          parts.push(`${arg.name}: ${arg.message}\n${arg.stack}`);
        } else {
          parts.push(`${arg.name}: ${arg.message}`);
        }
      } else if (typeof arg === "object" && arg !== null) {
        parts.push(safeStringify(arg));
      } else {
        parts.push(String(arg));
      }
    }

    return parts.join(" ");
  };

  const postLog = (type: string, message: string) => {
    window.postMessage(
      {
        type: "DEVTOOLS_EXPORT_LOG",
        data: {
          type,
          text: message,
          timestamp: Date.now(),
          isTop: window.top === window,
          frameUrl: window.location.href,
        },
      },
      "*"
    );
  };

  const postNetwork = (data: Record<string, unknown>) => {
    window.postMessage(
      {
        type: "DEVTOOLS_EXPORT_NETWORK",
        data,
      },
      "*"
    );
  };

  const capBody = (value: string | null): string | null => {
    if (!value) return null;
    if (value.length <= BODY_PREVIEW_CHAR_LIMIT) return value;
    return `${value.slice(0, BODY_PREVIEW_CHAR_LIMIT)}\n[TRUNCATED body preview]`;
  };

  const headersToRecord = (headers: Headers): Record<string, string> => {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  };

  const parseRawHeaders = (value: string): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const line of value.trim().split(/\r?\n/)) {
      const index = line.indexOf(":");
      if (index <= 0) continue;
      result[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
    }
    return result;
  };

  const bodyInitToText = async (body: BodyInit | null | undefined): Promise<string | null> => {
    try {
      if (!body) return null;
      if (typeof body === "string") return capBody(body);
      if (body instanceof URLSearchParams) return capBody(body.toString());
      if (body instanceof FormData) {
        const values: Record<string, string[]> = {};
        body.forEach((value, key) => {
          const list = values[key] ?? [];
          list.push(typeof value === "string" ? value : `[File: ${value.name}]`);
          values[key] = list;
        });
        return capBody(JSON.stringify(values));
      }
      if (body instanceof Blob && /^text\/|json|xml|javascript|x-www-form-urlencoded/i.test(body.type)) {
        return capBody(await body.text());
      }
    } catch {
      return null;
    }
    return null;
  };

  const bodyInitToTextSync = (body: Document | XMLHttpRequestBodyInit | null | undefined): string | null => {
    try {
      if (!body) return null;
      if (typeof body === "string") return capBody(body);
      if (body instanceof URLSearchParams) return capBody(body.toString());
      if (body instanceof FormData) {
        const values: Record<string, string[]> = {};
        body.forEach((value, key) => {
          const list = values[key] ?? [];
          list.push(typeof value === "string" ? value : `[File: ${value.name}]`);
          values[key] = list;
        });
        return capBody(JSON.stringify(values));
      }
    } catch {
      return null;
    }
    return null;
  };

  const requestInputToUrl = (input: RequestInfo | URL): string => {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    return input.url;
  };

  const requestInputToMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
    if (init?.method) return init.method.toUpperCase();
    if (input instanceof Request) return input.method.toUpperCase();
    return "GET";
  };

  const requestHeadersForFetch = (input: RequestInfo | URL, init?: RequestInit): Record<string, string> => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    return headersToRecord(headers);
  };

  const requestBodyForFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<string | null> => {
    if (init?.body) return bodyInitToText(init.body);
    if (input instanceof Request) {
      try {
        return capBody(await input.clone().text());
      } catch {
        return null;
      }
    }
    return null;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const startedAt = performance.now();
    const timestamp = Date.now();
    const url = requestInputToUrl(input);
    const method = requestInputToMethod(input, init);
    const requestHeaders = requestHeadersForFetch(input, init);
    const requestBody = await requestBodyForFetch(input, init);

    try {
      const response = await originalFetch(input, init);
      const responseHeaders = headersToRecord(response.headers);
      const contentType = response.headers.get("content-type") ?? "";
      let responseBody: string | null = null;
      if (/^text\/|json|xml|javascript|x-www-form-urlencoded/i.test(contentType)) {
        try {
          responseBody = capBody(await response.clone().text());
        } catch {
          responseBody = null;
        }
      }
      postNetwork({
        method,
        url,
        status: response.status,
        time: Math.round(performance.now() - startedAt),
        timestamp,
        initiatorType: "fetch",
        requestHeaders,
        responseHeaders,
        requestBody,
        responseBody,
      });
      return response;
    } catch (error) {
      postNetwork({
        method,
        url,
        status: 0,
        time: Math.round(performance.now() - startedAt),
        timestamp,
        initiatorType: "fetch",
        requestHeaders,
        responseHeaders: {},
        requestBody,
        responseBody: null,
      });
      throw error;
    }
  };

  window.XMLHttpRequest = function PatchedXMLHttpRequest() {
    const xhr = new OriginalXMLHttpRequest();
    let method = "GET";
    let url = "";
    let timestamp = Date.now();
    let startedAt = performance.now();
    const requestHeaders: Record<string, string> = {};

    const originalOpen = xhr.open;
    xhr.open = ((nextMethod: string, nextUrl: string | URL, ...args: unknown[]) => {
      method = String(nextMethod || "GET").toUpperCase();
      url = String(nextUrl);
      return originalOpen.apply(xhr, [nextMethod, nextUrl, ...args] as Parameters<XMLHttpRequest["open"]>);
    }) as XMLHttpRequest["open"];

    const originalSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = (name: string, value: string) => {
      requestHeaders[name.toLowerCase()] = value;
      return originalSetRequestHeader.call(xhr, name, value);
    };

    const originalSend = xhr.send;
    xhr.send = ((body?: Document | XMLHttpRequestBodyInit | null) => {
      timestamp = Date.now();
      startedAt = performance.now();
      const requestBody = bodyInitToTextSync(body);
      xhr.addEventListener("loadend", () => {
        let responseBody: string | null = null;
        try {
          if (xhr.responseType === "" || xhr.responseType === "text") {
            responseBody = capBody(xhr.responseText);
          } else if (xhr.responseType === "json") {
            responseBody = capBody(JSON.stringify(xhr.response));
          }
        } catch {
          responseBody = null;
        }
        postNetwork({
          method,
          url,
          status: xhr.status || 0,
          time: Math.round(performance.now() - startedAt),
          timestamp,
          initiatorType: "xmlhttprequest",
          requestHeaders,
          responseHeaders: parseRawHeaders(xhr.getAllResponseHeaders()),
          requestBody,
          responseBody,
        });
      }, { once: true });
      originalSend.call(xhr, body ?? null);
    }) as XMLHttpRequest["send"];

    return xhr;
  } as unknown as typeof XMLHttpRequest;
  window.XMLHttpRequest.prototype = OriginalXMLHttpRequest.prototype;
  Object.defineProperties(window.XMLHttpRequest, {
    UNSENT: { value: OriginalXMLHttpRequest.UNSENT },
    OPENED: { value: OriginalXMLHttpRequest.OPENED },
    HEADERS_RECEIVED: { value: OriginalXMLHttpRequest.HEADERS_RECEIVED },
    LOADING: { value: OriginalXMLHttpRequest.LOADING },
    DONE: { value: OriginalXMLHttpRequest.DONE },
  });

  ["log", "warn", "error", "info", "debug"].forEach((method) => {
    const original = originalConsole[method as keyof typeof originalConsole];
    console[method as keyof Console] = (...args: unknown[]) => {
      original.apply(console, args as unknown as []);
      const message = formatMessage(args);
      postLog(method, message);
    };
  });

  window.addEventListener("error", (event) => {
    const errorEvent = event as ErrorEvent;
    if (errorEvent.error && errorEvent.error.stack) {
      postLog("error", `${errorEvent.error.name}: ${errorEvent.error.message}\n${errorEvent.error.stack}`);
    } else if (errorEvent.message && errorEvent.filename) {
      postLog("error", `${errorEvent.message} at ${errorEvent.filename}:${errorEvent.lineno}:${errorEvent.colno}`);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const rejectionEvent = event as PromiseRejectionEvent;
    const reason = rejectionEvent.reason;
    if (reason instanceof Error) {
      postLog("error", `Unhandled Promise Rejection: ${reason.name}: ${reason.message}${reason.stack ? `\n${reason.stack}` : ""}`);
    } else {
      postLog("error", `Unhandled Promise Rejection: ${String(reason)}`);
    }
  });
})();
