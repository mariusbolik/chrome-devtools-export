const safeStringify = (value: unknown, depth = 0): string => {
  if (depth > 8) return "[Max Depth Reached]";

  try {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
    if (typeof value === "symbol") return value.toString();
    if (value instanceof Date) return value.toString();
    if (value instanceof RegExp) return value.toString();
    if (value instanceof Error) return formatError(value);
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

const formatError = (error: Error): string => {
  const title = [error.name || "Error", error.message].filter(Boolean).join(": ");
  if (!error.stack) return title;
  return error.stack.startsWith(title) ? error.stack : `${title}\n${error.stack}`;
};

export const formatConsoleMessage = (args: unknown[]): string => {
  if (args.length === 0) return "";
  const parts: string[] = [];

  for (const arg of args) {
    if (arg instanceof Error) {
      parts.push(formatError(arg));
    } else if (typeof arg === "object" && arg !== null) {
      parts.push(safeStringify(arg));
    } else {
      parts.push(String(arg));
    }
  }

  return parts.join(" ");
};
