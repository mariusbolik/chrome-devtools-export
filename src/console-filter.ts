import { normalizeConsoleText } from "./console-format";

const EMPTY_ERROR_TEXT = /^(Error|[A-Z][A-Za-z]*Error)$/;

export function shouldSuppressConsoleLog(log: { type?: string; text?: unknown }): boolean {
  if (log.type !== "debug") return false;
  const text = normalizeConsoleText(String(log.text ?? "")).trim();
  return EMPTY_ERROR_TEXT.test(text);
}
