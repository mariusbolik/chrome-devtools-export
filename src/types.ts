export interface NetworkRequest {
  id: number;
  method: string;
  url: string;
  status: number;
  time: number;
  source?: "devtools" | "page-intercept" | "resource-timing" | "web-request";
  initiatorType?: string;
  transferSize?: number;
  encodedBodySize?: number;
  decodedBodySize?: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
}

export interface StorageData {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: Record<string, string>;
  indexedDB: Record<string, unknown>;
}

export interface ConsoleLogEntry {
  id: number;
  type: "log" | "info" | "warn" | "error" | "debug";
  text: string;
  timestamp: number;
  source: "content";
  args?: unknown[];
  stackTrace?: unknown;
  level?: string;
  isTop?: boolean;
  frameUrl?: string;
}
