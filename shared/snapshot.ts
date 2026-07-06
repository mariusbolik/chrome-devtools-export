export const SNAPSHOT_SCHEMA_VERSION = "devtools-export.snapshot.v1" as const;
export const SHARE_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const SHARE_ID_LENGTH = 8;
export const REDACTED_VALUE = "[REDACTED]";

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|set-cookie|token|secret|password|passwd|api[-_]?key|access[-_]?key|session|sid|jwt|credential/i;

export interface NetworkRequestSnapshot {
  id: number;
  method: string;
  url: string;
  status: number;
  time: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
}

export interface StorageSnapshot {
  localStorage: Record<string, unknown>;
  sessionStorage: Record<string, unknown>;
  cookies: Record<string, unknown>;
  indexedDB: Record<string, unknown>;
}

export interface ConsoleLogSnapshot {
  id: number;
  type: "log" | "info" | "warn" | "error" | "debug";
  text: string;
  timestamp: number;
  source: "content" | "devtools";
  args?: unknown[];
  stackTrace?: unknown;
  level?: string;
  isTop?: boolean;
  frameUrl?: string;
}

export interface InstalledExtensionSnapshot {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  type?: string;
  installType?: string;
  permissions?: string[];
  hostPermissions?: string[];
}

export interface EnvironmentSnapshot {
  userAgent?: string;
  language?: string;
  languages?: string[];
  platform?: string;
  vendor?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  timezone?: string;
  screen?: Record<string, unknown>;
  viewport?: Record<string, unknown>;
  browser?: Record<string, unknown>;
  cloudflare?: Record<string, unknown>;
}

export interface CdpSnapshot {
  screenshotDataUrl?: string;
  layoutMetrics?: unknown;
  domSnapshot?: unknown;
  performanceMetrics?: unknown;
  cookies?: unknown;
  target?: unknown;
  pageAssets?: unknown;
  pageResources?: unknown;
  errors?: string[];
}

export interface SnapshotNotice {
  path: string;
  reason: string;
  originalBytes?: number;
}

export interface ShareSnapshot {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  expiresAt?: string;
  page: {
    url: string;
    title?: string;
    referrer?: string;
  };
  extension: {
    id?: string;
    version?: string;
  };
  environment: EnvironmentSnapshot;
  installedExtensions: InstalledExtensionSnapshot[];
  network: NetworkRequestSnapshot[];
  console: ConsoleLogSnapshot[];
  storage: StorageSnapshot;
  cdp: CdpSnapshot;
  redactions: SnapshotNotice[];
  truncations: SnapshotNotice[];
}

export interface CreateSnapshotInput {
  id: string;
  url: string;
  title?: string;
  referrer?: string;
  createdAt?: string;
  expiresAt?: string;
  extension?: ShareSnapshot["extension"];
  environment?: EnvironmentSnapshot;
  installedExtensions?: InstalledExtensionSnapshot[];
  network?: NetworkRequestSnapshot[];
  console?: ConsoleLogSnapshot[];
  storage?: Partial<StorageSnapshot>;
  cdp?: CdpSnapshot;
  redactions?: SnapshotNotice[];
  truncations?: SnapshotNotice[];
}

export interface RedactionResult {
  snapshot: ShareSnapshot;
  redactions: SnapshotNotice[];
}

export interface RedactionOptions {
  includeSensitive?: boolean;
  includeScreenshot?: boolean;
}

export interface TrimmingResult {
  snapshot: ShareSnapshot;
  truncations: SnapshotNotice[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function buildShareId(): string {
  const bytes = new Uint8Array(SHARE_ID_LENGTH);
  crypto.getRandomValues(bytes);

  let id = "";
  for (const byte of bytes) {
    id += SHARE_ID_ALPHABET[byte % SHARE_ID_ALPHABET.length];
  }
  return id;
}

export function createSnapshot(input: CreateSnapshotInput): ShareSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    id: input.id,
    createdAt: input.createdAt ?? new Date().toISOString(),
    expiresAt: input.expiresAt,
    page: {
      url: input.url,
      title: input.title,
      referrer: input.referrer,
    },
    extension: input.extension ?? {},
    environment: input.environment ?? {},
    installedExtensions: input.installedExtensions ?? [],
    network: input.network ?? [],
    console: input.console ?? [],
    storage: {
      localStorage: input.storage?.localStorage ?? {},
      sessionStorage: input.storage?.sessionStorage ?? {},
      cookies: input.storage?.cookies ?? {},
      indexedDB: input.storage?.indexedDB ?? {},
    },
    cdp: input.cdp ?? {},
    redactions: input.redactions ?? [],
    truncations: input.truncations ?? [],
  };
}

export function redactSnapshot(
  snapshot: ShareSnapshot,
  includeSensitiveOrOptions: boolean | RedactionOptions = false
): RedactionResult {
  const options = normalizeRedactionOptions(includeSensitiveOrOptions);
  if (options.includeSensitive) {
    return { snapshot: clone(snapshot), redactions: [] };
  }

  const next = clone(snapshot);
  const redactions: SnapshotNotice[] = [];

  next.page.url = redactUrl(next.page.url, "page.url", redactions);
  if (next.page.referrer) {
    next.page.referrer = redactUrl(next.page.referrer, "page.referrer", redactions);
  }

  next.network = next.network.map((request, index) => {
    const path = `network[${index}]`;
    return {
      ...request,
      url: redactUrl(request.url, `${path}.url`, redactions),
      requestHeaders: redactStringRecord(request.requestHeaders, `${path}.requestHeaders`, redactions),
      responseHeaders: redactStringRecord(request.responseHeaders, `${path}.responseHeaders`, redactions),
      requestBody: redactBody(request.requestBody, `${path}.requestBody`, redactions),
      responseBody: redactBody(request.responseBody, `${path}.responseBody`, redactions),
    };
  });

  next.console = next.console.map((entry, index) => ({
    ...entry,
    text: redactSensitiveText(entry.text, `console[${index}].text`, redactions),
  }));

  next.storage.localStorage = redactRecord(next.storage.localStorage, "storage.localStorage", redactions);
  next.storage.sessionStorage = redactRecord(next.storage.sessionStorage, "storage.sessionStorage", redactions);
  next.storage.cookies = redactRecord(next.storage.cookies, "storage.cookies", redactions, true);

  if (next.cdp.screenshotDataUrl && !options.includeScreenshot) {
    next.cdp.screenshotDataUrl = REDACTED_VALUE;
    redactions.push({ path: "cdp.screenshotDataUrl", reason: "CDP screenshot is sensitive by default" });
  }
  if (next.cdp.domSnapshot) {
    next.cdp.domSnapshot = REDACTED_VALUE;
    redactions.push({ path: "cdp.domSnapshot", reason: "DOM snapshot is sensitive by default" });
  }
  if (next.cdp.cookies) {
    next.cdp.cookies = REDACTED_VALUE;
    redactions.push({ path: "cdp.cookies", reason: "CDP cookies are sensitive by default" });
  }

  next.redactions = [...next.redactions, ...redactions];
  return { snapshot: next, redactions };
}

function normalizeRedactionOptions(value: boolean | RedactionOptions): Required<RedactionOptions> {
  if (typeof value === "boolean") {
    return {
      includeSensitive: value,
      includeScreenshot: value,
    };
  }

  return {
    includeSensitive: value.includeSensitive === true,
    includeScreenshot: value.includeScreenshot === true,
  };
}

export function trimSnapshotToBytes(snapshot: ShareSnapshot, maxBytes: number): TrimmingResult {
  const next = clone(snapshot);
  const truncations: SnapshotNotice[] = [];

  const recordTruncation = (path: string, reason: string, value: unknown) => {
    truncations.push({
      path,
      reason,
      originalBytes: byteLength(value),
    });
  };

  const overLimit = () => byteLength(next) > maxBytes;

  for (const [index, request] of next.network.entries()) {
    if (!overLimit()) break;
    if (request.responseBody) {
      recordTruncation(`network[${index}].responseBody`, "Response body exceeded upload budget", request.responseBody);
      request.responseBody = "[TRUNCATED responseBody]";
    }
    if (!overLimit()) break;
    if (request.requestBody) {
      recordTruncation(`network[${index}].requestBody`, "Request body exceeded upload budget", request.requestBody);
      request.requestBody = "[TRUNCATED requestBody]";
    }
  }

  if (overLimit() && next.cdp.screenshotDataUrl) {
    recordTruncation("cdp.screenshotDataUrl", "Screenshot exceeded upload budget", next.cdp.screenshotDataUrl);
    next.cdp.screenshotDataUrl = "[TRUNCATED screenshotDataUrl]";
  }

  if (overLimit() && next.cdp.domSnapshot) {
    recordTruncation("cdp.domSnapshot", "DOM snapshot exceeded upload budget", next.cdp.domSnapshot);
    next.cdp.domSnapshot = "[TRUNCATED domSnapshot]";
  }

  if (overLimit() && next.console.length > 100) {
    recordTruncation("console", "Console log list exceeded upload budget", next.console);
    next.console = next.console.slice(0, 100);
  }

  if (overLimit() && next.network.length > 100) {
    recordTruncation("network", "Network request list exceeded upload budget", next.network);
    next.network = next.network.slice(0, 100);
  }

  if (overLimit()) {
    recordTruncation("storage.indexedDB", "IndexedDB metadata exceeded upload budget", next.storage.indexedDB);
    next.storage.indexedDB = {};
  }

  next.truncations = [...next.truncations, ...truncations];

  if (byteLength(next) > maxBytes) {
    throw new Error(`Snapshot exceeds ${maxBytes} bytes after trimming`);
  }

  return { snapshot: next, truncations };
}

export function validateSnapshot(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["Snapshot must be an object"] };
  }

  if (value.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) errors.push("Unsupported schemaVersion");
  if (typeof value.id !== "string" || !isValidShareId(value.id)) errors.push("Invalid snapshot id");
  if (typeof value.createdAt !== "string") errors.push("createdAt must be a string");
  if (!isRecord(value.page) || typeof value.page.url !== "string") {
    errors.push("page.url must be a string");
  } else if (!isSafeHttpUrl(value.page.url)) {
    errors.push("page.url must be an http(s) URL");
  }
  if (!Array.isArray(value.network)) errors.push("network must be an array");
  if (!Array.isArray(value.console)) errors.push("console must be an array");
  if (!isRecord(value.storage)) errors.push("storage must be an object");
  if (!isRecord(value.cdp)) errors.push("cdp must be an object");
  if (!Array.isArray(value.redactions)) errors.push("redactions must be an array");
  if (!Array.isArray(value.truncations)) errors.push("truncations must be an array");

  return { ok: errors.length === 0, errors };
}

export function isValidShareId(id: string): boolean {
  return id.length === SHARE_ID_LENGTH && [...id].every((char) => SHARE_ID_ALPHABET.includes(char));
}

export function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function redactUrl(urlValue: string, path: string, redactions: SnapshotNotice[]): string {
  try {
    const url = new URL(urlValue);
    for (const key of [...url.searchParams.keys()]) {
      if (!SENSITIVE_KEY_PATTERN.test(key)) continue;
      url.searchParams.set(key, REDACTED_VALUE);
      redactions.push({ path: `${path}.searchParams.${key}`, reason: "Sensitive URL parameter" });
    }
    if (url.hash) {
      const redactedHash = redactSensitiveText(url.hash.slice(1), `${path}.hash`, redactions);
      url.hash = redactedHash;
    }
    return url.toString();
  } catch {
    return urlValue;
  }
}

function redactRecord(
  record: Record<string, unknown>,
  path: string,
  redactions: SnapshotNotice[],
  redactAllValues = false
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (redactAllValues || SENSITIVE_KEY_PATTERN.test(key)) {
        redactions.push({ path: `${path}.${key}`, reason: "Sensitive field" });
        return [key, REDACTED_VALUE];
      }
      if (isRecord(value)) {
        return [key, redactRecord(value, `${path}.${key}`, redactions)];
      }
      return [key, value];
    })
  );
}

function redactStringRecord(
  record: Record<string, string>,
  path: string,
  redactions: SnapshotNotice[]
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        redactions.push({ path: `${path}.${key}`, reason: "Sensitive field" });
        return [key, REDACTED_VALUE];
      }
      return [key, value];
    })
  );
}

function redactBody(body: string | null, path: string, redactions: SnapshotNotice[]): string | null {
  if (!body) return body;

  redactions.push({ path, reason: "Request and response bodies are sensitive by default" });
  return REDACTED_VALUE;
}

function redactSensitiveText(text: string, path: string, redactions: SnapshotNotice[]): string {
  let next = text;
  const before = next;

  next = next.replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${REDACTED_VALUE}`);
  next = next.replace(
    /\b((?:access[-_]?token|id[-_]?token|refresh[-_]?token|auth[-_]?token|token|secret|password|passwd|api[-_]?key|session|sid|jwt)\s*[:=]\s*)[^&#\s'",;)}\]]+/gi,
    `$1${REDACTED_VALUE}`
  );
  next = next.replace(
    /("?(?:access[-_]?token|id[-_]?token|refresh[-_]?token|auth[-_]?token|token|secret|password|passwd|api[-_]?key|session|sid|jwt)"?\s*:\s*")([^"]*)(")/gi,
    `$1${REDACTED_VALUE}$3`
  );

  if (next !== before) {
    redactions.push({ path, reason: "Sensitive text content" });
  }
  return next;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
