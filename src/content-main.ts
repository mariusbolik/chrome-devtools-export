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
