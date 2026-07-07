import { REDACTED_VALUE, type CdpSnapshot, type ShareSnapshot, type StorageSnapshot } from "../../../shared/snapshot";

export type ViewValueType = "array" | "boolean" | "null" | "number" | "object" | "string";

export interface StorageViewRow {
  key: string;
  value: string;
  valueType: ViewValueType;
}

export interface StorageViewSection {
  id: keyof StorageSnapshot;
  label: string;
  rows: StorageViewRow[];
}

export interface DetailViewRow {
  label: string;
  value: string;
  valueType: ViewValueType;
}

export interface StatusViewRow {
  label: string;
  value: string;
  tone: "error" | "neutral" | "ok" | "warn";
}

export type PrivacyViewRow = StatusViewRow;

export interface CdpAssetViewRow {
  type: "Image" | "Script" | "Stylesheet";
  url: string;
  safeUrl: string;
  path: string;
}

export interface CdpResourceViewRow {
  initiatorType: string;
  path: string;
  duration: string;
  url: string;
  safeUrl: string;
}

export interface CdpViewModel {
  statusRows: StatusViewRow[];
  screenshot: {
    state: "available" | "missing" | "redacted";
    label: string;
    src: string | null;
  };
  hasScreenshot: boolean;
  domSnapshot: {
    state: "available" | "missing" | "redacted";
    label: string;
  };
  layoutRows: DetailViewRow[];
  performanceRows: DetailViewRow[];
  assets: CdpAssetViewRow[];
  resources: CdpResourceViewRow[];
  errors: string[];
}

export interface EnvironmentViewSection {
  id: "browser" | "device" | "extension" | "location";
  label: string;
  rows: DetailViewRow[];
}

export interface InstalledExtensionViewRow {
  id: string;
  name: string;
  version: string;
  enabled: "Disabled" | "Enabled";
  type: string;
  installType: string;
  permissions: string;
  hostPermissions: string;
}

export interface EnvironmentViewModel {
  sections: EnvironmentViewSection[];
  installedExtensions: InstalledExtensionViewRow[];
}

export interface ShareViewModel {
  id: string;
  seoTitle: string;
  title: string;
  url: string;
  safeUrl: string;
  domain: string;
  createdAt: string;
  expiresAt: string;
  browser: {
    label: string;
    iconUrl: string | null;
  };
  location: {
    label: string;
    flagUrl: string | null;
  };
  counts: {
    network: number;
    networkErrors: number;
    console: number;
    consoleErrors: number;
    storageBuckets: number;
    installedExtensions: number;
    redactions: number;
    truncations: number;
  };
  storage: {
    sections: StorageViewSection[];
    totalRows: number;
  };
  cdp: CdpViewModel;
  environment: EnvironmentViewModel;
  privacy: {
    summaryRows: PrivacyViewRow[];
    detailRows: PrivacyViewRow[];
  };
}

const BROWSER_ICON_BASE = "https://cdn.jsdelivr.net/gh/alrra/browser-logos@main/src";
const FLAG_BASE = "https://cdn.jsdelivr.net/npm/flagpack@1.0.5/flags/1x1";
const STORAGE_SECTIONS: Array<{ id: keyof StorageSnapshot; label: string }> = [
  { id: "localStorage", label: "Local Storage" },
  { id: "sessionStorage", label: "Session Storage" },
  { id: "cookies", label: "Cookies" },
  { id: "indexedDB", label: "IndexedDB" },
];

export function buildShareViewModel(snapshot: ShareSnapshot): ShareViewModel {
  const browserName = readString(snapshot.environment.browser, ["browser", "name"]);
  const browserVersion = readString(snapshot.environment.browser, ["browser", "version"]);
  const country = String(snapshot.environment.cloudflare?.country ?? "unknown").toUpperCase();
  const city = String(snapshot.environment.cloudflare?.city ?? "");
  const storageSections = buildStorageSections(snapshot.storage);
  const cdp = buildCdpViewModel(snapshot.cdp);

  return {
    id: snapshot.id,
    seoTitle: `DevToolsExport #${snapshot.id}`,
    title: snapshot.page.title || "DevTools snapshot",
    url: snapshot.page.url,
    safeUrl: safeHttpUrl(snapshot.page.url),
    domain: getDomain(snapshot.page.url),
    createdAt: snapshot.createdAt,
    expiresAt: snapshot.expiresAt ?? "unknown",
    browser: {
      label: [browserName, browserVersion].filter(Boolean).join(" ") || "Unknown browser",
      iconUrl: browserIconUrl(browserName),
    },
    location: {
      label: [city, country !== "UNKNOWN" ? country : ""].filter(Boolean).join(", ") || "Unknown location",
      flagUrl: country !== "UNKNOWN" ? `${FLAG_BASE}/${country.toLowerCase()}.svg` : null,
    },
    counts: {
      network: snapshot.network.length,
      networkErrors: snapshot.network.filter((request) => request.status >= 400).length,
      console: snapshot.console.length,
      consoleErrors: snapshot.console.filter((entry) => entry.type === "error").length,
      storageBuckets: Object.keys(snapshot.storage).length,
      installedExtensions: snapshot.installedExtensions.length,
      redactions: snapshot.redactions.length,
      truncations: snapshot.truncations.length,
    },
    storage: {
      sections: storageSections,
      totalRows: storageSections.reduce((total, section) => total + section.rows.length, 0),
    },
    cdp,
    environment: buildEnvironmentViewModel(snapshot),
    privacy: buildPrivacyViewModel(snapshot),
  };
}

function buildPrivacyViewModel(snapshot: ShareSnapshot): ShareViewModel["privacy"] {
  const redactions = snapshot.redactions;
  const truncations = snapshot.truncations;
  const binaryBodies = redactions.filter((notice) => notice.reason === "Binary body omitted").length;
  const bodyPaths = new Set(
    redactions
      .filter((notice) => notice.reason === "Sensitive body value redacted")
      .map((notice) => notice.path.match(/^network\[\d+\]\.(?:requestBody|responseBody)/)?.[0])
      .filter((path): path is string => Boolean(path))
  );
  const cookieRedactions = redactions.filter((notice) => notice.reason === "Cookie value redacted").length;
  const domSnapshotHidden = redactions.some((notice) => notice.path === "cdp.domSnapshot");
  const trimmedPayloads = truncations.length + redactions.filter((notice) => notice.reason === "Body preview trimmed").length;
  const sensitiveRedactions = redactions.length - binaryBodies;

  return {
    summaryRows: [
      privacyRow("Sensitive Values Redacted", sensitiveRedactions, sensitiveRedactions > 0 ? "warn" : "neutral"),
      privacyRow("Bodies Partially Shown", bodyPaths.size, bodyPaths.size > 0 ? "ok" : "neutral"),
      privacyRow("Binary Bodies Omitted", binaryBodies, binaryBodies > 0 ? "warn" : "neutral"),
      privacyRow("Payloads Trimmed", trimmedPayloads, trimmedPayloads > 0 ? "warn" : "neutral"),
      {
        label: "DOM Snapshot Hidden",
        value: domSnapshotHidden ? "Yes" : "No",
        tone: domSnapshotHidden ? "warn" : "neutral",
      },
      privacyRow("Cookie Values Redacted", cookieRedactions, cookieRedactions > 0 ? "warn" : "neutral"),
    ],
    detailRows: groupedNoticeRows([...redactions, ...truncations]),
  };
}

function privacyRow(label: string, value: number, tone: PrivacyViewRow["tone"]): PrivacyViewRow {
  return { label, value: String(value), tone };
}

function groupedNoticeRows(notices: ShareSnapshot["redactions"]): PrivacyViewRow[] {
  const groups = new Map<string, number>();
  for (const notice of notices) {
    groups.set(notice.reason, (groups.get(notice.reason) ?? 0) + 1);
  }

  return [...groups.entries()].map(([label, count]) => ({
    label,
    value: String(count),
    tone: "warn" as const,
  }));
}

function buildStorageSections(storage: StorageSnapshot): StorageViewSection[] {
  return STORAGE_SECTIONS.map((section) => {
    const values = storage[section.id] ?? {};
    return {
      ...section,
      rows: Object.keys(values)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => ({
          key,
          value: formatStorageValue(values[key]),
          valueType: storageValueType(values[key]),
        })),
    };
  });
}

function formatStorageValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "[]" : value.map(formatStorageValue).join(", ");

  if (typeof value === "object" && value) {
    const metadata = value as Record<string, unknown>;
    const version = metadata.version !== undefined ? `version ${formatStorageValue(metadata.version)}` : "";
    const stores = Array.isArray(metadata.stores) ? `stores: ${metadata.stores.map(formatStorageValue).join(", ")}` : "";
    if (version || stores) return [version, stores].filter(Boolean).join(", ");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function storageValueType(value: unknown): StorageViewRow["valueType"] {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const type = typeof value;
  if (type === "boolean" || type === "number" || type === "string") return type;
  return "object";
}

function buildCdpViewModel(cdp: CdpSnapshot): CdpViewModel {
  const screenshot = buildScreenshotState(cdp.screenshotDataUrl);
  const domSnapshot = buildCaptureState(cdp.domSnapshot, "DOM Snapshot");
  const layoutRows = buildLayoutRows(cdp.layoutMetrics);
  const performanceRows = buildPerformanceRows(cdp.performanceMetrics);
  const errors = Array.isArray(cdp.errors) ? cdp.errors.filter((error): error is string => typeof error === "string") : [];

  return {
    statusRows: [
      ...(screenshot.src ? [{ label: "Screenshot", value: screenshot.label, tone: "ok" as const }] : []),
      { label: "DOM Snapshot", value: domSnapshot.label, tone: captureTone(domSnapshot.state) },
      { label: "Performance Metrics", value: pluralize(performanceRows.length, "metric"), tone: performanceRows.length > 0 ? "ok" : "neutral" },
      { label: "CDP Errors", value: pluralize(errors.length, "error"), tone: errors.length > 0 ? "error" : "ok" },
    ],
    screenshot,
    hasScreenshot: screenshot.src !== null,
    domSnapshot,
    layoutRows,
    performanceRows,
    assets: buildAssetRows(cdp.pageAssets),
    resources: buildResourceRows(cdp.pageResources),
    errors,
  };
}

function buildScreenshotState(value: unknown): CdpViewModel["screenshot"] {
  if (typeof value === "string" && value.startsWith("data:image/")) {
    return { state: "available", label: "Captured", src: value };
  }
  return { state: "missing", label: "Screenshot not captured", src: null };
}

function buildCaptureState(value: unknown, label: string): CdpViewModel["screenshot"] {
  if (isRedacted(value)) return { state: "redacted", label: "Redacted", src: null };
  if (typeof value === "string" && value.startsWith("data:image/")) {
    return { state: "available", label: "Captured", src: value };
  }
  if (value !== undefined && value !== null) return { state: "available", label: "Captured", src: null };
  return { state: "missing", label: `${label} not captured`, src: null };
}

function captureTone(state: CdpViewModel["screenshot"]["state"]): StatusViewRow["tone"] {
  if (state === "available") return "ok";
  if (state === "redacted") return "warn";
  return "neutral";
}

function buildLayoutRows(layoutMetrics: unknown): DetailViewRow[] {
  const layout = asRecord(layoutMetrics);
  if (!layout) return [];

  const viewport = asRecord(layout.cssLayoutViewport);
  const contentSize = asRecord(layout.contentSize);
  return [
    dimensionRow("Viewport", viewport?.clientWidth, viewport?.clientHeight),
    dimensionRow("Content Size", contentSize?.width, contentSize?.height),
  ].filter((row): row is DetailViewRow => row !== null);
}

function dimensionRow(label: string, width: unknown, height: unknown): DetailViewRow | null {
  if (typeof width !== "number" || typeof height !== "number") return null;
  return { label, value: `${width} x ${height}`, valueType: "object" };
}

function buildPerformanceRows(performanceMetrics: unknown): DetailViewRow[] {
  const metrics = asRecord(performanceMetrics);
  if (!Array.isArray(metrics?.metrics)) return [];

  return metrics.metrics
    .map((metric) => {
      const row = asRecord(metric);
      if (!row || typeof row.name !== "string") return null;
      return {
        label: row.name,
        value: formatStorageValue(row.value),
        valueType: storageValueType(row.value),
      };
    })
    .filter((row): row is DetailViewRow => row !== null);
}

function buildAssetRows(pageAssets: unknown): CdpAssetViewRow[] {
  const assets = asRecord(pageAssets);
  if (!assets) return [];

  return [
    ...assetRowsForType("Image", assets.images),
    ...assetRowsForType("Script", assets.scripts),
    ...assetRowsForType("Stylesheet", assets.stylesheets),
  ];
}

function assetRowsForType(type: CdpAssetViewRow["type"], value: unknown): CdpAssetViewRow[] {
  return asStringArray(value).map((url) => ({
    type,
    url,
    safeUrl: safeHttpUrl(url),
    path: pathForUrl(url),
  }));
}

function buildResourceRows(pageResources: unknown): CdpResourceViewRow[] {
  if (!Array.isArray(pageResources)) return [];

  return pageResources
    .map((resource) => {
      const row = asRecord(resource);
      if (!row || typeof row.name !== "string") return null;
      const duration = typeof row.duration === "number" && Number.isFinite(row.duration) ? `${Math.round(row.duration)}ms` : "unknown";
      return {
        initiatorType: typeof row.initiatorType === "string" && row.initiatorType ? row.initiatorType : "unknown",
        path: pathForUrl(row.name),
        duration,
        url: row.name,
        safeUrl: safeHttpUrl(row.name),
      };
    })
    .filter((row): row is CdpResourceViewRow => row !== null);
}

function buildEnvironmentViewModel(snapshot: ShareSnapshot): EnvironmentViewModel {
  const environment = snapshot.environment;
  const browser = environment.browser;
  const cloudflare = environment.cloudflare;

  return {
    sections: [
      {
        id: "browser",
        label: "Browser",
        rows: compactRows([
          detailRow("Browser", joinParts(readString(browser, ["browser", "name"]), readString(browser, ["browser", "version"]))),
          detailRow("OS", joinParts(readString(browser, ["os", "name"]), readString(browser, ["os", "version"]))),
          detailRow("User Agent", environment.userAgent),
          detailRow("Languages", environment.languages?.join(", ") || environment.language),
          detailRow("Vendor", environment.vendor),
        ]),
      },
      {
        id: "device",
        label: "Device",
        rows: compactRows([
          detailRow("Platform", environment.platform),
          detailRow("CPU", readString(browser, ["cpu", "architecture"])),
          detailRow("Hardware Threads", environment.hardwareConcurrency, "number"),
          detailRow("Memory", typeof environment.deviceMemory === "number" ? `${environment.deviceMemory} GB` : undefined, "number"),
          detailRow("Viewport", formatViewport(environment.viewport), "object"),
          detailRow("Screen", formatScreen(environment.screen), "object"),
        ]),
      },
      {
        id: "location",
        label: "Location",
        rows: compactRows([
          detailRow("Location", joinCommaParts(readString(cloudflare, ["city"]), readString(cloudflare, ["country"]))),
          detailRow("Country", readString(cloudflare, ["country"])),
          detailRow("Timezone", readString(cloudflare, ["timezone"]) || environment.timezone),
          detailRow("Cloudflare Colo", readString(cloudflare, ["colo"])),
        ]),
      },
      {
        id: "extension",
        label: "Extension",
        rows: compactRows([
          detailRow("Extension ID", snapshot.extension.id),
          detailRow("Extension Version", snapshot.extension.version),
        ]),
      },
    ],
    installedExtensions: snapshot.installedExtensions.map((extension) => ({
      id: extension.id,
      name: extension.name,
      version: extension.version,
      enabled: extension.enabled ? "Enabled" : "Disabled",
      type: extension.type || "unknown",
      installType: extension.installType || "unknown",
      permissions: pluralize(extension.permissions?.length ?? 0, "permission"),
      hostPermissions: pluralize(extension.hostPermissions?.length ?? 0, "host permission"),
    })),
  };
}

function detailRow(label: string, value: unknown, valueType: ViewValueType = storageValueType(value)): DetailViewRow | null {
  if (value === undefined || value === null || value === "") return null;
  return {
    label,
    value: formatStorageValue(value),
    valueType,
  };
}

function compactRows(rows: Array<DetailViewRow | null>): DetailViewRow[] {
  return rows.filter((row): row is DetailViewRow => row !== null);
}

function formatViewport(viewportValue: unknown): string | undefined {
  const viewport = asRecord(viewportValue);
  if (!viewport || typeof viewport.width !== "number" || typeof viewport.height !== "number") return undefined;
  const scale = typeof viewport.devicePixelRatio === "number" ? ` @${viewport.devicePixelRatio}x` : "";
  return `${viewport.width} x ${viewport.height}${scale}`;
}

function formatScreen(screenValue: unknown): string | undefined {
  const screen = asRecord(screenValue);
  if (!screen || typeof screen.width !== "number" || typeof screen.height !== "number") return undefined;
  const colorDepth = typeof screen.colorDepth === "number" ? `, ${screen.colorDepth}-bit color` : "";
  return `${screen.width} x ${screen.height}${colorDepth}`;
}

function pathForUrl(urlValue: string): string {
  try {
    const parsed = new URL(urlValue);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return urlValue;
  }
}

function pluralize(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function joinParts(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function joinCommaParts(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(", ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function isRedacted(value: unknown): boolean {
  return value === REDACTED_VALUE || value === "[REDACTED]";
}

function getDomain(urlValue: string): string {
  try {
    return new URL(urlValue).hostname;
  } catch {
    return urlValue;
  }
}

function safeHttpUrl(urlValue: string): string {
  try {
    const url = new URL(urlValue);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    // Fall through to fallback.
  }
  return "#";
}

function browserIconUrl(name: string): string | null {
  const slug = name.toLowerCase();
  if (slug.includes("chrome") || slug.includes("chromium")) {
    return `${BROWSER_ICON_BASE}/chrome/chrome.svg`;
  }
  if (slug.includes("firefox")) {
    return `${BROWSER_ICON_BASE}/firefox/firefox.svg`;
  }
  if (slug.includes("safari")) {
    return `${BROWSER_ICON_BASE}/safari/safari.svg`;
  }
  if (slug.includes("edge")) {
    return `${BROWSER_ICON_BASE}/edge/edge.svg`;
  }
  return null;
}

function readString(value: unknown, path: string[]): string {
  let current = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) return "";
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : "";
}
