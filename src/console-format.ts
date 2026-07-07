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

export const normalizeConsoleText = (value: string): string => {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/^(Error|[A-Z][A-Za-z]*Error):\s*(?=\n|$)/, "$1");
  return normalized !== trimmed ? normalized : value;
};

const GENERIC_ERROR_TEXT = /^(Error|[A-Z][A-Za-z]*Error)$/;
const EXTENSION_STACK_FRAME = /content-main\.(?:js|ts)|console\.<computed>/;
const CALL_STACK_LIMIT = 8;

const formatError = (error: Error): string => {
  const title = [error.name || "Error", error.message].filter(Boolean).join(": ");
  if (!error.stack) return normalizeConsoleText(title);
  return error.stack.startsWith(title) ? normalizeConsoleText(error.stack) : `${title}\n${error.stack}`;
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

export const formatConsoleMessageWithCallStack = (args: unknown[], callStack?: string): string => {
  const message = formatConsoleMessage(args);
  if (!GENERIC_ERROR_TEXT.test(message) || !callStack) return message;

  const pageFrames = callStack
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim() && !EXTENSION_STACK_FRAME.test(line))
    .slice(0, CALL_STACK_LIMIT);

  return pageFrames.length ? `${message}\nConsole call stack:\n${pageFrames.join("\n")}` : message;
};
