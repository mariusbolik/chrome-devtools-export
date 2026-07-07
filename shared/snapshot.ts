export const SNAPSHOT_SCHEMA_VERSION = "devtools-export.snapshot.v1" as const;
export const SHARE_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const SHARE_ID_LENGTH = 8;
export const REDACTED_VALUE = "[REDACTED]";
export const SHARE_APP_HOST = "devtoolsexport.com";
export const SHARE_APP_URL_BLOCK_MESSAGE = "DevToolsExport cannot create bug reports for devtoolsexport.com.";

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|set-cookie|token|secret|password|passwd|api[-_]?key|access[-_]?key|session|sid|jwt|credential/i;
const BODY_PREVIEW_CHAR_LIMIT = 16_384;
const BINARY_BODY_OMITTED = "[BINARY body omitted]";

export interface NetworkRequestSnapshot {
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
  id?: string;
  name: string;
  version?: string;
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

export interface PageDiagnosticsSnapshot {
  document?: {
    readyState?: string;
    visibilityState?: string;
    online?: boolean;
  };
  navigation?: {
    type?: string;
    duration?: number;
    domContentLoaded?: number;
    loadEvent?: number;
    responseEnd?: number;
  };
  paints?: Array<{
    name: string;
    startTime: number;
  }>;
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
  pageDiagnostics?: PageDiagnosticsSnapshot;
  installedExtensions: InstalledExtensionSnapshot[];
  network: NetworkRequestSnapshot[];
  console: ConsoleLogSnapshot[];
  storage: StorageSnapshot;
  cdp: CdpSnapshot;
  redactions: SnapshotNotice[];
  truncations: SnapshotNotice[];
  captureNotices?: SnapshotNotice[];
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
  pageDiagnostics?: PageDiagnosticsSnapshot;
  installedExtensions?: InstalledExtensionSnapshot[];
  network?: NetworkRequestSnapshot[];
  console?: ConsoleLogSnapshot[];
  storage?: Partial<StorageSnapshot>;
  cdp?: CdpSnapshot;
  redactions?: SnapshotNotice[];
  truncations?: SnapshotNotice[];
  captureNotices?: SnapshotNotice[];
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

export function isShareAppUrl(urlValue: string | undefined): boolean {
  if (!urlValue) return false;

  try {
    const hostname = new URL(urlValue).hostname.toLowerCase();
    return hostname === SHARE_APP_HOST || hostname.endsWith(`.${SHARE_APP_HOST}`);
  } catch {
    return false;
  }
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
    pageDiagnostics: input.pageDiagnostics,
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
    captureNotices: input.captureNotices ?? [],
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
    frameUrl: entry.frameUrl ? redactUrl(entry.frameUrl, `console[${index}].frameUrl`, redactions) : entry.frameUrl,
    args: entry.args ? redactUnknownValue(entry.args, `console[${index}].args`, redactions, "Sensitive console metadata redacted") as unknown[] : entry.args,
    stackTrace: entry.stackTrace
      ? redactUnknownValue(entry.stackTrace, `console[${index}].stackTrace`, redactions, "Sensitive console metadata redacted")
      : entry.stackTrace,
  }));

  next.installedExtensions = next.installedExtensions.map((extension, index) =>
    redactInstalledExtension(extension, `installedExtensions[${index}]`, redactions)
  );
  next.environment.cloudflare = redactCloudflareLocation(next.environment.cloudflare, "environment.cloudflare", redactions);

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
    next.cdp.cookies = redactCdpCookies(next.cdp.cookies, "cdp.cookies", redactions);
  }
  if (next.cdp.pageAssets) {
    next.cdp.pageAssets = redactPageAssets(next.cdp.pageAssets, "cdp.pageAssets", redactions);
  }
  if (next.cdp.pageResources) {
    next.cdp.pageResources = redactPageResources(next.cdp.pageResources, "cdp.pageResources", redactions);
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
        redactions.push({ path: `${path}.${key}`, reason: redactAllValues ? "Cookie value redacted" : "Sensitive field" });
        return [key, REDACTED_VALUE];
      }
      if (Array.isArray(value)) {
        return [key, redactArray(value, `${path}.${key}`, redactions)];
      }
      if (isRecord(value)) {
        return [key, redactRecord(value, `${path}.${key}`, redactions)];
      }
      if (typeof value === "string") {
        return [key, redactStructuredTextValue(value, `${path}.${key}`, redactions, "Sensitive field")];
      }
      return [key, value];
    })
  );
}

function redactInstalledExtension(
  extension: InstalledExtensionSnapshot,
  path: string,
  redactions: SnapshotNotice[]
): InstalledExtensionSnapshot {
  if (extension.id !== undefined) redactions.push({ path: `${path}.id`, reason: "Installed extension identifier redacted" });
  if (extension.version !== undefined) redactions.push({ path: `${path}.version`, reason: "Installed extension version redacted" });
  if (extension.installType !== undefined) redactions.push({ path: `${path}.installType`, reason: "Installed extension install type redacted" });
  if (extension.permissions !== undefined) redactions.push({ path: `${path}.permissions`, reason: "Installed extension permissions redacted" });
  if (extension.hostPermissions !== undefined) redactions.push({ path: `${path}.hostPermissions`, reason: "Installed extension host permissions redacted" });

  return {
    name: extension.name,
    enabled: extension.enabled,
    type: extension.type,
  };
}

function redactCloudflareLocation(
  cloudflare: Record<string, unknown> | undefined,
  path: string,
  redactions: SnapshotNotice[]
): Record<string, unknown> | undefined {
  if (!cloudflare) return cloudflare;

  const keep: Record<string, unknown> = {};
  if (cloudflare.country !== undefined) keep.country = cloudflare.country;
  if (cloudflare.colo !== undefined) keep.colo = cloudflare.colo;

  for (const key of Object.keys(cloudflare)) {
    if (key === "country" || key === "colo") continue;
    redactions.push({ path: `${path}.${key}`, reason: "Precise location metadata redacted" });
  }

  return keep;
}

function redactArray(value: unknown[], path: string, redactions: SnapshotNotice[]): unknown[] {
  return value.map((item, index) => redactUnknownValue(item, `${path}[${index}]`, redactions, "Sensitive field"));
}

function redactStringRecord(
  record: Record<string, string>,
  path: string,
  redactions: SnapshotNotice[]
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      return [key, redactHeaderValue(key, value, `${path}.${key}`, redactions)];
    })
  );
}

function redactBody(body: string | null, path: string, redactions: SnapshotNotice[]): string | null {
  if (!body) return body;

  if (isProbablyBinaryBody(body)) {
    redactions.push({ path, reason: "Binary body omitted" });
    return BINARY_BODY_OMITTED;
  }

  const json = parseJson(body);
  if (json.ok) {
    const redacted = redactUnknownValue(json.value, path, redactions, "Sensitive body value redacted");
    return limitBodyPreview(JSON.stringify(redacted, null, 2), path, redactions);
  }

  if (looksLikeUrlEncodedBody(body)) {
    return limitBodyPreview(redactUrlEncodedBody(body, path, redactions), path, redactions);
  }

  return limitBodyPreview(redactSensitiveText(body, path, redactions, "Sensitive body value redacted"), path, redactions);
}

function redactHeaderValue(key: string, value: string, path: string, redactions: SnapshotNotice[]): string {
  const lowerKey = key.toLowerCase();

  if (lowerKey === "authorization" || lowerKey === "proxy-authorization") {
    redactions.push({ path, reason: "Sensitive header value redacted" });
    const scheme = value.match(/^\s*([A-Za-z]+)\s+(.+)$/);
    return scheme ? `${scheme[1]} ${REDACTED_VALUE}` : REDACTED_VALUE;
  }

  if (lowerKey === "cookie") {
    return redactCookieHeader(value, path, redactions);
  }

  if (lowerKey === "set-cookie") {
    return redactSetCookieHeader(value, path, redactions);
  }

  if (SENSITIVE_KEY_PATTERN.test(key)) {
    redactions.push({ path, reason: "Sensitive header value redacted" });
    return REDACTED_VALUE;
  }

  return redactSensitiveText(value, path, redactions, "Sensitive header value redacted");
}

function redactCookieHeader(value: string, path: string, redactions: SnapshotNotice[]): string {
  let changed = false;
  const redacted = value
    .split(";")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return part;
      const separator = trimmed.indexOf("=");
      if (separator === -1) return trimmed;
      changed = true;
      const name = trimmed.slice(0, separator).trim();
      return `${name}=${REDACTED_VALUE}`;
    })
    .join("; ");

  if (changed) {
    redactions.push({ path, reason: "Cookie value redacted" });
  }
  return redacted;
}

function redactSetCookieHeader(value: string, path: string, redactions: SnapshotNotice[]): string {
  const parts = value.split(";").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return value;

  const separator = parts[0].indexOf("=");
  if (separator === -1) return value;

  const cookieName = parts[0].slice(0, separator).trim();
  redactions.push({ path, reason: "Cookie value redacted" });
  return [`${cookieName}=${REDACTED_VALUE}`, ...parts.slice(1)].join("; ");
}

function redactUrlEncodedBody(body: string, path: string, redactions: SnapshotNotice[]): string {
  const params = new URLSearchParams(body);
  for (const key of [...params.keys()]) {
    const values = params.getAll(key);
    params.delete(key);
    for (const value of values) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        params.append(key, REDACTED_VALUE);
        redactions.push({ path: `${path}.${key}`, reason: "Sensitive body value redacted" });
      } else {
        params.append(key, redactSensitiveText(value, `${path}.${key}`, redactions, "Sensitive body value redacted"));
      }
    }
  }
  return params.toString();
}

function redactStructuredTextValue(
  value: string,
  path: string,
  redactions: SnapshotNotice[],
  reason: string
): string {
  if (isSafeHttpUrl(value)) {
    return redactUrl(value, path, redactions);
  }

  const json = parseJson(value);
  if (json.ok) {
    const redacted = redactUnknownValue(json.value, path, redactions, reason);
    return JSON.stringify(redacted, null, 2);
  }

  if (looksLikeUrlEncodedBody(value)) {
    return redactUrlEncodedBody(value, path, redactions);
  }

  return redactSensitiveText(value, path, redactions, reason);
}

function redactUnknownValue(value: unknown, path: string, redactions: SnapshotNotice[], reason: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => redactUnknownValue(item, `${path}[${index}]`, redactions, reason));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        const childPath = `${path}.${key}`;
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          redactions.push({ path: childPath, reason });
          return [key, REDACTED_VALUE];
        }
        return [key, redactUnknownValue(child, childPath, redactions, reason)];
      })
    );
  }

  if (typeof value === "string") {
    return redactStructuredTextValue(value, path, redactions, reason);
  }

  return value;
}

function redactCdpCookies(value: unknown, path: string, redactions: SnapshotNotice[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => redactCdpCookies(item, `${path}[${index}]`, redactions));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        const childPath = `${path}.${key}`;
        if (key.toLowerCase() === "value" || SENSITIVE_KEY_PATTERN.test(key)) {
          redactions.push({ path: childPath, reason: "Cookie value redacted" });
          return [key, REDACTED_VALUE];
        }
        return [key, redactCdpCookies(child, childPath, redactions)];
      })
    );
  }

  return value;
}

function redactPageAssets(value: unknown, path: string, redactions: SnapshotNotice[]): unknown {
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      const childPath = `${path}.${key}`;
      if (Array.isArray(child)) {
        return [
          key,
          child.map((item, index) => typeof item === "string" ? redactUrl(item, `${childPath}[${index}]`, redactions) : item),
        ];
      }
      return [key, redactUnknownValue(child, childPath, redactions, "Sensitive asset metadata redacted")];
    })
  );
}

function redactPageResources(value: unknown, path: string, redactions: SnapshotNotice[]): unknown {
  if (!Array.isArray(value)) return value;

  return value.map((item, index) => {
    if (!isRecord(item)) return item;
    return Object.fromEntries(
      Object.entries(item).map(([key, child]) => {
        const childPath = `${path}[${index}].${key}`;
        if (key === "name" && typeof child === "string") {
          return [key, redactUrl(child, childPath, redactions)];
        }
        return [key, redactUnknownValue(child, childPath, redactions, "Sensitive resource metadata redacted")];
      })
    );
  });
}

function limitBodyPreview(body: string, path: string, redactions: SnapshotNotice[]): string {
  if (body.length <= BODY_PREVIEW_CHAR_LIMIT) return body;
  redactions.push({ path, reason: "Body preview trimmed", originalBytes: new TextEncoder().encode(body).byteLength });
  return `${body.slice(0, BODY_PREVIEW_CHAR_LIMIT)}\n[TRUNCATED body preview]`;
}

function isProbablyBinaryBody(body: string): boolean {
  if (/^data:(?:image|audio|video|font)\//i.test(body)) return true;
  if (/^data:application\/(?:octet-stream|pdf|zip)/i.test(body)) return true;
  if (body.includes("\0")) return true;

  const sample = body.slice(0, 1024);
  if (!sample) return false;
  let controlCharacters = 0;
  for (const char of sample) {
    const code = char.charCodeAt(0);
    if (code < 32 && char !== "\n" && char !== "\r" && char !== "\t") {
      controlCharacters += 1;
    }
  }
  return controlCharacters / sample.length > 0.05;
}

function looksLikeUrlEncodedBody(body: string): boolean {
  if (!/(^|&)[^=&\s]+=[^&]*/.test(body)) return false;
  try {
    return [...new URLSearchParams(body).keys()].length > 0;
  } catch {
    return false;
  }
}

function parseJson(value: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed || !"[{".includes(trimmed[0])) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
}

function redactSensitiveText(
  text: string,
  path: string,
  redactions: SnapshotNotice[],
  reason = "Sensitive text content"
): string {
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
    redactions.push({ path, reason });
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
