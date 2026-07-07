import type { ConsoleLogEntry } from "./types";

const CONSOLE_TYPES = new Set(["log", "info", "warn", "error", "debug"]);

export function normalizePanelConsoleEntry(value: unknown): ConsoleLogEntry {
  const record = isRecord(value) ? value : {};
  const type = typeof record.type === "string" && CONSOLE_TYPES.has(record.type) ? record.type : "log";
  return {
    id: typeof record.id === "number" ? record.id : Date.now() + Math.random(),
    type: type as ConsoleLogEntry["type"],
    text: typeof record.text === "string" ? record.text : "",
    timestamp: typeof record.timestamp === "number" ? record.timestamp : Date.now(),
    source: "content",
    ...(typeof record.isTop === "boolean" ? { isTop: record.isTop } : {}),
    ...(typeof record.frameUrl === "string" ? { frameUrl: record.frameUrl } : {}),
  };
}

export function panelPathForUrl(value: string | null | undefined): string {
  if (!value) return "(unknown)";
  try {
    const url = new URL(value);
    return url.pathname || url.href;
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
