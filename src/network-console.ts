import type { NetworkRequestSnapshot } from "../shared/snapshot";
import type { ConsoleLogEntry } from "./types";

const STACK_FRAME_LIMIT = 80;

export function networkFailureConsoleText(request: NetworkRequestSnapshot): string | null {
  if (request.status !== 0 || !request.error) return null;

  const lines = [`${request.method} ${request.url} ${request.error}`];
  const stack = filteredStackTrace(request.stackTrace);
  if (stack) lines.push(stack);
  return lines.join("\n");
}

export function networkFailureConsoleEntry(
  request: NetworkRequestSnapshot,
  options: { id: number; timestamp: number; frameUrl?: string }
): ConsoleLogEntry | null {
  const text = networkFailureConsoleText(request);
  if (!text) return null;

  return {
    id: options.id,
    type: "error",
    text,
    timestamp: options.timestamp,
    source: "content",
    isTop: true,
    frameUrl: options.frameUrl,
  };
}

export function withNetworkFailureConsoleLogs(
  consoleLogs: ConsoleLogEntry[],
  networkRequests: NetworkRequestSnapshot[],
  frameUrl?: string
): ConsoleLogEntry[] {
  const existing = new Set(consoleLogs.map((entry) => firstLine(entry.text)));
  const synthesized = networkRequests
    .map((request, index) =>
      networkFailureConsoleEntry(request, {
        id: Date.now() + index,
        timestamp: Date.now() + index,
        frameUrl,
      })
    )
    .filter((entry): entry is ConsoleLogEntry => Boolean(entry))
    .filter((entry) => !existing.has(firstLine(entry.text)));

  return [...consoleLogs, ...synthesized];
}

function filteredStackTrace(value: string | undefined): string {
  if (!value) return "";

  return value
    .split(/\r?\n/)
    .slice(1, STACK_FRAME_LIMIT + 1)
    .filter((line) => line.trim())
    .join("\n");
}

function firstLine(value: string): string {
  return value.split(/\r?\n/)[0] ?? value;
}
