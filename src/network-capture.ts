import type { NetworkRequestSnapshot } from "../shared/snapshot";

const BODY_PREVIEW_CHAR_LIMIT = 16_384;
const REQUEST_MATCH_WINDOW_MS = 5_000;

interface HeaderLike {
  name: string;
  value?: string;
}

interface WebRequestBase {
  tabId: number;
  requestId: string;
  method?: string;
  url: string;
  type?: string;
  timeStamp: number;
}

export interface WebRequestBeforeRequest extends WebRequestBase {
  method: string;
  requestBody?: {
    error?: string;
    formData?: Record<string, string[]>;
    raw?: Array<{ bytes?: ArrayBuffer; file?: string }>;
  } | null;
}

export interface WebRequestSendHeaders extends WebRequestBase {
  method: string;
  requestHeaders?: HeaderLike[];
}

export interface WebRequestHeadersReceived extends WebRequestBase {
  method?: string;
  statusCode: number;
  responseHeaders?: HeaderLike[];
}

export interface WebRequestFinished extends WebRequestHeadersReceived {
  error?: string;
}

export interface PageNetworkEntry {
  method: string;
  url: string;
  status: number;
  time: number;
  timestamp: number;
  initiatorType?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string | null;
  responseBody?: string | null;
}

interface MutableNetworkRequest {
  requestId: string;
  tabId: number;
  method: string;
  url: string;
  status: number;
  startTime: number;
  endTime?: number;
  initiatorType?: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
}

export interface NetworkCaptureStore {
  limit: number;
  requests: Map<string, MutableNetworkRequest>;
  order: string[];
  pageEntries: Map<number, PageNetworkEntry[]>;
}

export function createNetworkCaptureStore(limit = 500): NetworkCaptureStore {
  return {
    limit,
    requests: new Map(),
    order: [],
    pageEntries: new Map(),
  };
}

export function recordBeforeRequest(store: NetworkCaptureStore, details: WebRequestBeforeRequest): void {
  if (details.tabId < 0) return;
  const record = ensureRecord(store, details);
  record.method = normalizeMethod(details.method);
  record.url = details.url;
  record.startTime = details.timeStamp;
  record.initiatorType = details.type;
  record.requestBody = formatRequestBody(details.requestBody);
  pruneTab(store, details.tabId);
}

export function recordSendHeaders(store: NetworkCaptureStore, details: WebRequestSendHeaders): void {
  if (details.tabId < 0) return;
  const record = ensureRecord(store, details);
  record.method = normalizeMethod(details.method);
  record.requestHeaders = headersToRecord(details.requestHeaders);
}

export function recordHeadersReceived(store: NetworkCaptureStore, details: WebRequestHeadersReceived): void {
  if (details.tabId < 0) return;
  const record = ensureRecord(store, details);
  if (details.method) record.method = normalizeMethod(details.method);
  record.status = details.statusCode;
  record.responseHeaders = headersToRecord(details.responseHeaders);
}

export function recordCompleted(store: NetworkCaptureStore, details: WebRequestFinished): void {
  if (details.tabId < 0) return;
  const record = ensureRecord(store, details);
  if (details.method) record.method = normalizeMethod(details.method);
  record.status = details.statusCode;
  record.endTime = details.timeStamp;
  if (details.responseHeaders?.length) {
    record.responseHeaders = headersToRecord(details.responseHeaders);
  }
}

export function recordErrorOccurred(store: NetworkCaptureStore, details: WebRequestFinished): void {
  if (details.tabId < 0) return;
  const record = ensureRecord(store, details);
  if (details.method) record.method = normalizeMethod(details.method);
  record.status = 0;
  record.endTime = details.timeStamp;
}

export function recordPageNetworkEntry(store: NetworkCaptureStore, tabId: number, entry: PageNetworkEntry): void {
  if (tabId < 0) return;
  const entries = store.pageEntries.get(tabId) ?? [];
  entries.push({
    ...entry,
    method: normalizeMethod(entry.method),
    requestBody: capBody(entry.requestBody ?? null),
    responseBody: capBody(entry.responseBody ?? null),
  });
  while (entries.length > store.limit) entries.shift();
  store.pageEntries.set(tabId, entries);
}

export function clearNetworkCaptureForTab(store: NetworkCaptureStore, tabId: number): void {
  for (const key of [...store.requests.keys()]) {
    if (store.requests.get(key)?.tabId === tabId) store.requests.delete(key);
  }
  store.order = store.order.filter((key) => store.requests.has(key));
  store.pageEntries.delete(tabId);
}

export function getCapturedNetworkRequests(store: NetworkCaptureStore, tabId: number): NetworkRequestSnapshot[] {
  const webRows = [...store.requests.values()]
    .filter((record) => record.tabId === tabId)
    .sort((a, b) => a.startTime - b.startTime);
  const pageRows = (store.pageEntries.get(tabId) ?? []).sort((a, b) => a.timestamp - b.timestamp);
  const usedWebRows = new Set<MutableNetworkRequest>();
  const rows: Array<{ sortTime: number; request: NetworkRequestSnapshot }> = [];

  for (const pageRow of pageRows) {
    const match = findMatchingWebRow(pageRow, webRows, usedWebRows);
    if (match) usedWebRows.add(match);
    rows.push({ sortTime: pageRow.timestamp, request: pageEntryToSnapshot(pageRow, match) });
  }

  for (const webRow of webRows) {
    if (!usedWebRows.has(webRow)) rows.push({ sortTime: webRow.startTime, request: webRequestToSnapshot(webRow) });
  }

  return rows
    .sort((a, b) => a.sortTime - b.sortTime)
    .map(({ request }, index) => ({ ...request, id: index + 1 }));
}

export function mergeNetworkRequests(
  capturedRequests: NetworkRequestSnapshot[],
  fallbackRequests: NetworkRequestSnapshot[]
): NetworkRequestSnapshot[] {
  const capturedUrls = new Set(capturedRequests.map((request) => request.url));
  return [
    ...capturedRequests,
    ...fallbackRequests.filter((request) => !capturedUrls.has(request.url)),
  ];
}

function ensureRecord(store: NetworkCaptureStore, details: WebRequestBase): MutableNetworkRequest {
  const key = requestKey(details.tabId, details.requestId);
  const existing = store.requests.get(key);
  if (existing) return existing;

  const record: MutableNetworkRequest = {
    requestId: details.requestId,
    tabId: details.tabId,
    method: normalizeMethod(details.method ?? "UNKNOWN"),
    url: details.url,
    status: 0,
    startTime: details.timeStamp,
    initiatorType: details.type,
    requestHeaders: {},
    responseHeaders: {},
    requestBody: null,
    responseBody: null,
  };
  store.requests.set(key, record);
  store.order.push(key);
  return record;
}

function pruneTab(store: NetworkCaptureStore, tabId: number): void {
  const keysForTab = store.order.filter((key) => store.requests.get(key)?.tabId === tabId);
  while (keysForTab.length > store.limit) {
    const key = keysForTab.shift();
    if (key) {
      store.requests.delete(key);
      store.order = store.order.filter((item) => item !== key);
    }
  }
}

function requestKey(tabId: number, requestId: string): string {
  return `${tabId}:${requestId}`;
}

function headersToRecord(headers: HeaderLike[] | undefined): Record<string, string> {
  if (!headers) return {};
  return Object.fromEntries(
    headers
      .filter((header) => header.name && typeof header.value === "string")
      .map((header) => [header.name.toLowerCase(), header.value as string])
  );
}

function formatRequestBody(body: WebRequestBeforeRequest["requestBody"]): string | null {
  if (!body) return null;
  if (body.formData) return capBody(JSON.stringify(body.formData));
  if (!body.raw?.length) return null;

  const parts = body.raw.map((part) => {
    if (part.file) return "[FILE upload omitted]";
    if (!part.bytes) return "";
    try {
      return new TextDecoder().decode(part.bytes);
    } catch {
      return "";
    }
  }).filter(Boolean);
  return capBody(parts.join(""));
}

function findMatchingWebRow(
  pageRow: PageNetworkEntry,
  webRows: MutableNetworkRequest[],
  usedWebRows: Set<MutableNetworkRequest>
): MutableNetworkRequest | null {
  const candidates = webRows.filter((record) =>
    !usedWebRows.has(record) &&
    record.url === pageRow.url &&
    record.method === normalizeMethod(pageRow.method) &&
    Math.abs(record.startTime - pageRow.timestamp) <= REQUEST_MATCH_WINDOW_MS
  );
  return candidates.sort((a, b) => Math.abs(a.startTime - pageRow.timestamp) - Math.abs(b.startTime - pageRow.timestamp))[0] ?? null;
}

function pageEntryToSnapshot(pageRow: PageNetworkEntry, webRow: MutableNetworkRequest | null): NetworkRequestSnapshot {
  return {
    id: 0,
    method: normalizeMethod(pageRow.method),
    url: pageRow.url,
    status: pageRow.status,
    time: Math.round(pageRow.time || webRowDuration(webRow)),
    source: "page-intercept",
    initiatorType: pageRow.initiatorType || webRow?.initiatorType,
    requestHeaders: {
      ...(webRow?.requestHeaders ?? {}),
      ...(pageRow.requestHeaders ?? {}),
    },
    responseHeaders: {
      ...(webRow?.responseHeaders ?? {}),
      ...(pageRow.responseHeaders ?? {}),
    },
    requestBody: pageRow.requestBody ?? webRow?.requestBody ?? null,
    responseBody: pageRow.responseBody ?? null,
  };
}

function webRequestToSnapshot(record: MutableNetworkRequest): NetworkRequestSnapshot {
  return {
    id: 0,
    method: record.method,
    url: record.url,
    status: record.status,
    time: webRowDuration(record),
    source: "web-request",
    initiatorType: record.initiatorType,
    requestHeaders: record.requestHeaders,
    responseHeaders: record.responseHeaders,
    requestBody: record.requestBody,
    responseBody: record.responseBody,
  };
}

function webRowDuration(record: MutableNetworkRequest | null): number {
  if (!record?.endTime) return 0;
  return Math.max(0, Math.round(record.endTime - record.startTime));
}

function normalizeMethod(method: string): string {
  return method ? method.toUpperCase() : "UNKNOWN";
}

function capBody(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= BODY_PREVIEW_CHAR_LIMIT) return value;
  return `${value.slice(0, BODY_PREVIEW_CHAR_LIMIT)}\n[TRUNCATED body preview]`;
}
