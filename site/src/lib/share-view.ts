import { REDACTED_VALUE, type CdpSnapshot, type NetworkRequestSnapshot, type ShareSnapshot, type StorageSnapshot } from "../../../shared/snapshot";

export type ViewValueType = "array" | "boolean" | "null" | "number" | "object" | "string";

export interface StorageViewRow {
  key: string;
  value: string;
  valueType: ViewValueType;
}

export interface StorageViewSection {
  id: keyof StorageSnapshot;
  anchorId: string;
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

export interface SummaryCardViewModel {
  label: string;
  value: string;
  detail: string;
  tone: StatusViewRow["tone"];
}

export type PrivacyViewRow = StatusViewRow;

export type SharePanelTarget =
  | "application"
  | "console"
  | "elements"
  | "environment"
  | "network"
  | "page"
  | "performance"
  | "resources"
  | "screenshot"
  | "sources"
  | "storage"
  | "triage";

export interface CaptureFidelityViewModel {
  mode: "devtools" | "empty" | "mixed" | "resource-timing";
  label: string;
  detail: string;
  tone: StatusViewRow["tone"];
}

export interface IssueViewRow {
  severity: "error" | "info" | "warn";
  title: string;
  detail: string;
  targetTab: SharePanelTarget;
  targetAnchor?: string;
}

export interface IssuesViewModel {
  items: IssueViewRow[];
  deviceRows: DetailViewRow[];
}

export interface NetworkViewRow {
  id: number;
  name: string;
  url: string;
  safeUrl: string;
  method: string;
  statusLabel: string;
  statusTone: StatusViewRow["tone"];
  type: string;
  sourceLabel: string;
  anchorId: string;
  methodClass: string;
  captureNote: string | null;
  size: string;
  time: string;
  hasHeaders: boolean;
  hasPayload: boolean;
  hasResponse: boolean;
}

export interface NetworkHeaderViewRow {
  name: string;
  value: string;
}

export interface NetworkDetailViewRow extends NetworkViewRow {
  requestHeaders: NetworkHeaderViewRow[];
  responseHeaders: NetworkHeaderViewRow[];
  requestBody: string | null;
  responseBody: string | null;
}

export interface NetworkViewModel {
  rows: NetworkViewRow[];
  details: NetworkDetailViewRow[];
}

export interface ConsoleViewRow {
  id: number;
  type: string;
  severity: "error" | "info" | "warn";
  anchorId: string;
  message: string;
  text: string;
  source: string;
  frame: string;
  timestamp: string;
  isTop: boolean | null;
}

export interface ConsoleViewModel {
  rows: ConsoleViewRow[];
  errorCount: number;
  warningCount: number;
}

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
  size?: string;
  statusLabel?: string;
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
  anchorId: string;
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

export interface SourceTreeSection {
  anchorId: string;
  origin: string;
  rows: Array<{
    type: string;
    path: string;
    duration: string;
    safeUrl: string;
  }>;
}

export interface SourcesViewModel {
  sections: SourceTreeSection[];
}

export interface PerformanceViewModel {
  documentRows: DetailViewRow[];
  navigationRows: DetailViewRow[];
  paintRows: DetailViewRow[];
  cdpRows: DetailViewRow[];
  slowResources: CdpResourceViewRow[];
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
  summaryCards: SummaryCardViewModel[];
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
  aiSummary: string;
  captureFidelity: CaptureFidelityViewModel;
  issues: IssuesViewModel;
  network: NetworkViewModel;
  console: ConsoleViewModel;
  storage: {
    sections: StorageViewSection[];
    totalRows: number;
  };
  cdp: CdpViewModel;
  sources: SourcesViewModel;
  performance: PerformanceViewModel;
  environment: EnvironmentViewModel;
  privacy: {
    summaryRows: PrivacyViewRow[];
    detailRows: PrivacyViewRow[];
  };
}

interface AiSummaryParts {
  browserLabel: string;
  locationLabel: string;
  captureFidelity: CaptureFidelityViewModel;
  issues: IssuesViewModel;
  network: NetworkViewModel;
  console: ConsoleViewModel;
  storage: ShareViewModel["storage"];
  cdp: CdpViewModel;
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
  const osName = readString(snapshot.environment.browser, ["os", "name"]);
  const country = String(snapshot.environment.cloudflare?.country ?? "unknown").toUpperCase();
  const city = String(snapshot.environment.cloudflare?.city ?? "");
  const storageSections = buildStorageSections(snapshot.storage);
  const cdp = buildCdpViewModel(snapshot.cdp);
  const environment = buildEnvironmentViewModel(snapshot);
  const network = buildNetworkViewModel(snapshot.network);
  const consoleModel = buildConsoleViewModel(snapshot.console);
  const captureFidelity = buildCaptureFidelity(snapshot.network);
  const performance = buildPerformanceViewModel(snapshot, cdp);
  const browserLabel = [browserName, browserVersion].filter(Boolean).join(" ") || "Unknown browser";
  const locationLabel = [city, country !== "UNKNOWN" ? country : ""].filter(Boolean).join(", ") || "Unknown location";
  const issues = buildIssuesViewModel(snapshot, cdp, environment, captureFidelity);
  const storage = {
    sections: storageSections,
    totalRows: storageSections.reduce((total, section) => total + section.rows.length, 0),
  };
  const privacy = buildPrivacyViewModel(snapshot);
  const counts = {
    network: snapshot.network.length,
    networkErrors: snapshot.network.filter((request) => request.status >= 400).length,
    console: snapshot.console.length,
    consoleErrors: snapshot.console.filter((entry) => entry.type === "error").length,
    storageBuckets: Object.keys(snapshot.storage).length,
    installedExtensions: snapshot.installedExtensions.length,
    redactions: snapshot.redactions.length,
    truncations: snapshot.truncations.length,
  };
  const summaryCards = buildSummaryCards(snapshot, {
    browserName,
    browserVersion,
    osName,
    country,
    counts,
    issues,
    network,
    console: consoleModel,
    storage,
    cdp,
  });

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
      label: browserLabel,
      iconUrl: browserIconUrl(browserName),
    },
    location: {
      label: locationLabel,
      flagUrl: country !== "UNKNOWN" ? `${FLAG_BASE}/${country.toLowerCase()}.svg` : null,
    },
    summaryCards,
    counts,
    aiSummary: buildAiSummary(snapshot, {
      browserLabel,
      locationLabel,
      captureFidelity,
      issues,
      network,
      console: consoleModel,
      storage,
      cdp,
    }),
    captureFidelity,
    issues,
    network,
    console: consoleModel,
    storage,
    cdp,
    sources: buildSourcesViewModel(cdp),
    performance,
    environment,
    privacy,
  };
}

function buildSummaryCards(
  snapshot: ShareSnapshot,
  parts: {
    browserName: string;
    browserVersion: string;
    osName: string;
    country: string;
    counts: ShareViewModel["counts"];
    issues: IssuesViewModel;
    network: NetworkViewModel;
    console: ConsoleViewModel;
    storage: ShareViewModel["storage"];
    cdp: CdpViewModel;
  }
): SummaryCardViewModel[] {
  const errorIssues = parts.issues.items.filter((issue) => issue.severity === "error").length;
  const warningIssues = parts.issues.items.filter((issue) => issue.severity === "warn").length;
  const slowRequests = parts.network.details.filter((request) => durationNumber(request.time) >= 1000).length;
  const hasHeaders = parts.network.details.some((request) => request.hasHeaders);
  const hasBodies = parts.network.details.some((request) => request.hasPayload || request.hasResponse);
  const contextDetail = joinCommaParts(
    parts.osName,
    parts.country !== "UNKNOWN" ? parts.country : "",
    formatCompactViewport(snapshot.environment.viewport)
  ) || "Unknown device";
  const evidenceValueParts = [
    parts.cdp.hasScreenshot ? "Screenshot" : "",
    parts.cdp.domSnapshot.state === "available" ? "DOM" : "",
  ].filter(Boolean);
  const evidenceDetailParts = [
    parts.storage.totalRows > 0 ? "Storage" : "",
    hasHeaders ? "headers" : "",
    hasBodies ? "bodies" : "",
  ].filter(Boolean);

  return [
    {
      label: "Triage",
      value: pluralize(parts.issues.items.length, "issue"),
      detail: `${pluralize(errorIssues, "error")}, ${pluralize(warningIssues, "warning")}`,
      tone: errorIssues > 0 ? "error" : warningIssues > 0 ? "warn" : "ok",
    },
    {
      label: "Network Requests",
      value: String(parts.counts.network),
      detail: `${pluralize(parts.counts.networkErrors, "failed", "failed")}, ${pluralize(slowRequests, "slow", "slow")}`,
      tone: parts.counts.networkErrors > 0 ? "error" : slowRequests > 0 ? "warn" : parts.counts.network > 0 ? "ok" : "neutral",
    },
    {
      label: "Console Logs",
      value: String(parts.counts.console),
      detail: `${pluralize(parts.console.errorCount, "error")}, ${pluralize(parts.console.warningCount, "warning")}`,
      tone: parts.console.errorCount > 0 ? "error" : parts.console.warningCount > 0 ? "warn" : parts.counts.console > 0 ? "ok" : "neutral",
    },
    {
      label: "User Context",
      value: compactBrowserLabel(parts.browserName, parts.browserVersion),
      detail: contextDetail,
      tone: "neutral",
    },
    {
      label: "Evidence",
      value: evidenceValueParts.length > 0 ? evidenceValueParts.join(" + ") : "Metadata only",
      detail: evidenceDetailParts.length > 0 ? evidenceDetailParts.join(", ") : "Basic report data",
      tone: evidenceValueParts.length > 0 || evidenceDetailParts.length > 0 ? "ok" : "neutral",
    },
  ];
}

function buildAiSummary(snapshot: ShareSnapshot, parts: AiSummaryParts): string {
  const failedRequests = parts.network.details
    .filter((request) => request.statusTone === "error" || request.statusTone === "warn")
    .slice(0, 5);
  const slowRequests = parts.network.details
    .filter((request) => durationNumber(request.time) >= 1000)
    .slice(0, failedRequests.length > 0 ? 3 : 5);
  const importantLogs = parts.console.rows
    .filter((entry) => entry.severity === "error" || entry.severity === "warn")
    .slice(0, 6);
  const limitedRequests = parts.network.details.filter((request) => request.sourceLabel === "Resource Timing").length;
  const lines: string[] = [
    "DevToolsExport AI debug summary",
    "Use this compact snapshot before asking for raw JSON.",
    "",
    `Snapshot: #${snapshot.id}`,
    `Page: ${snapshot.page.title || "Untitled"} (${snapshot.page.url})`,
    `Captured: ${snapshot.createdAt}`,
    `Expires: ${snapshot.expiresAt ?? "unknown"}`,
    "",
    "Environment",
    `- Browser: ${parts.browserLabel}`,
    `- Location: ${parts.locationLabel}`,
  ];

  for (const row of parts.issues.deviceRows.slice(0, 6)) {
    lines.push(`- ${row.label}: ${row.value}`);
  }

  lines.push(
    "",
    "Capture fidelity",
    `- ${parts.captureFidelity.label}: ${parts.captureFidelity.detail}`
  );
  if (limitedRequests > 0) {
    lines.push(`- ${limitedRequests} network rows came from Resource Timing and may miss status, headers, payload, and response body.`);
  }

  lines.push("", "Likely failures");
  if (parts.issues.items.length > 0) {
    for (const issue of parts.issues.items.slice(0, 8)) {
      lines.push(`- [${issue.severity}] ${issue.title}: ${issue.detail} (see #${issue.targetAnchor || issue.targetTab})`);
    }
  } else {
    lines.push("- No obvious console, network, or capture problems detected.");
  }

  lines.push("", "Console");
  lines.push(`- ${parts.console.rows.length} log entries; ${parts.console.errorCount} errors, ${parts.console.warningCount} warnings.`);
  if (importantLogs.length > 0) {
    for (const entry of importantLogs) {
      lines.push(`- [${entry.severity}] ${entry.message} (${entry.frame})`);
    }
  }

  lines.push("", "Network");
  lines.push(`- ${parts.network.rows.length} requests; ${failedRequests.length} failed.`);
  for (const request of failedRequests) {
    lines.push(`- ${request.statusLabel} ${request.method} ${request.name} (${request.sourceLabel}, ${request.time}, ${request.size})`);
  }
  for (const request of slowRequests) {
    lines.push(`- Slow: ${request.method} ${request.name} took ${request.time} (${request.sourceLabel})`);
  }

  lines.push(
    "",
    "Client state",
    `- Storage entries: ${parts.storage.totalRows}`,
    `- Installed extensions: ${snapshot.installedExtensions.length}`,
    `- Screenshot: ${parts.cdp.screenshot.label}`,
    `- DOM snapshot: ${parts.cdp.domSnapshot.label}`,
    "",
    "Privacy",
    `- Redactions: ${snapshot.redactions.length}; truncations: ${snapshot.truncations.length}.`,
    "- Secrets, cookies, sensitive body values, precise extension details, and DOM text may be redacted."
  );

  return lines.join("\n").trim();
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

function buildCaptureFidelity(network: NetworkRequestSnapshot[]): CaptureFidelityViewModel {
  if (network.length === 0) {
    return {
      mode: "empty",
      label: "No Network Capture",
      detail: "No network records were included in this snapshot.",
      tone: "neutral",
    };
  }

  const resourceTimingCount = network.filter(isResourceTimingRequest).length;
  const devtoolsCount = network.filter((request) => request.source === "devtools" || (!request.source && !isResourceTimingRequest(request))).length;
  const browserCaptureCount = network.filter((request) => request.source === "web-request" || request.source === "page-intercept").length;
  const richCaptureCount = devtoolsCount + browserCaptureCount;

  if (resourceTimingCount > 0 && richCaptureCount > 0) {
    return {
      mode: "mixed",
      label: "Mixed Capture",
      detail: "Includes detailed network records and Resource Timing records with limited HTTP details.",
      tone: "warn",
    };
  }

  if (resourceTimingCount > 0) {
    return {
      mode: "resource-timing",
      label: "Resource Timing Capture",
      detail: "Captured from the active tab. HTTP status, headers, payloads, and response bodies may be unavailable.",
      tone: "warn",
    };
  }

  if (browserCaptureCount > 0) {
    return {
      mode: "devtools",
      label: "Browser Network Capture",
      detail: "Captured from the popup with Chrome network events and page-level request body previews when available.",
      tone: "ok",
    };
  }

  return {
    mode: "devtools",
    label: "DevTools Network Capture",
    detail: "Captured from the DevTools panel with request and response metadata when Chrome exposed it.",
    tone: "ok",
  };
}

function buildIssuesViewModel(
  snapshot: ShareSnapshot,
  cdp: CdpViewModel,
  environment: EnvironmentViewModel,
  captureFidelity: CaptureFidelityViewModel
): IssuesViewModel {
  const items: IssueViewRow[] = [];
  const consoleError = snapshot.console.find((entry) => entry.type === "error");
  const failedRequest = snapshot.network.find((request) => request.status >= 400);
  const slowRequest = [...snapshot.network]
    .filter((request) => request.time >= 1000)
    .sort((a, b) => b.time - a.time)[0];

  if (consoleError) {
    items.push({
      severity: "error",
      title: "Console error",
      detail: firstLine(consoleError.text),
      targetTab: "console",
      targetAnchor: anchorId("console", consoleError.id),
    });
  }

  if (failedRequest) {
    items.push({
      severity: failedRequest.status >= 500 ? "error" : "warn",
      title: "Failed request",
      detail: `${failedRequest.status} ${failedRequest.method} ${pathForUrl(failedRequest.url)} in ${formatMilliseconds(failedRequest.time)}`,
      targetTab: "network",
      targetAnchor: anchorId("network", failedRequest.id),
    });
  }

  if (slowRequest) {
    items.push({
      severity: "warn",
      title: "Slow resource",
      detail: `${pathForUrl(slowRequest.url)} took ${formatMilliseconds(slowRequest.time)}`,
      targetTab: "network",
      targetAnchor: anchorId("network", slowRequest.id),
    });
  }

  if (captureFidelity.mode === "resource-timing") {
    items.push({
      severity: "warn",
      title: "Limited network evidence",
      detail: "Popup capture only includes Resource Timing data; HTTP status, headers, payloads, and response bodies may be unavailable.",
      targetTab: "network",
    });
  }

  if (cdp.errors.length > 0) {
    items.push({
      severity: "warn",
      title: "CDP capture issue",
      detail: firstLine(cdp.errors[0]),
      targetTab: "environment",
    });
  }

  for (const notice of (snapshot.captureNotices ?? []).slice(0, 3)) {
    items.push({
      severity: "warn",
      title: "Capture limitation",
      detail: notice.reason,
      targetTab: "environment",
    });
  }

  return {
    items,
    deviceRows: buildDeviceSummaryRows(snapshot, environment),
  };
}

function buildDeviceSummaryRows(snapshot: ShareSnapshot, environment: EnvironmentViewModel): DetailViewRow[] {
  const browserRows = environment.sections.find((section) => section.id === "browser")?.rows ?? [];
  const deviceRows = environment.sections.find((section) => section.id === "device")?.rows ?? [];
  const locationRows = environment.sections.find((section) => section.id === "location")?.rows ?? [];

  return compactRows([
    browserRows.find((row) => row.label === "Browser") ?? null,
    browserRows.find((row) => row.label === "OS") ?? null,
    deviceRows.find((row) => row.label === "Viewport") ?? null,
    deviceRows.find((row) => row.label === "Screen") ?? null,
    detailRow("Timezone", snapshot.environment.timezone || readString(snapshot.environment.cloudflare, ["timezone"])),
    locationRows.find((row) => row.label === "Location") ?? null,
    deviceRows.find((row) => row.label === "Hardware Threads") ?? null,
    deviceRows.find((row) => row.label === "Memory") ?? null,
  ]);
}

function buildNetworkViewModel(network: NetworkRequestSnapshot[]): NetworkViewModel {
  const details = network.map(buildNetworkDetailRow);
  return {
    rows: details.map(({ requestHeaders: _requestHeaders, responseHeaders: _responseHeaders, requestBody: _requestBody, responseBody: _responseBody, ...row }) => row),
    details,
  };
}

function buildNetworkDetailRow(request: NetworkRequestSnapshot): NetworkDetailViewRow {
  const hasRequestHeaders = Object.keys(request.requestHeaders).length > 0;
  const hasResponseHeaders = Object.keys(request.responseHeaders).length > 0;
  const isResourceTiming = isResourceTimingRequest(request);

  return {
    id: request.id,
    anchorId: anchorId("network", request.id),
    name: pathForUrl(request.url),
    url: request.url,
    safeUrl: safeHttpUrl(request.url),
    method: isResourceTiming ? "Not captured" : request.method,
    methodClass: isResourceTiming ? "not-captured" : cssToken(request.method),
    statusLabel: request.status > 0 ? String(request.status) : isResourceTiming ? "Not captured" : "Unknown",
    statusTone: networkStatusTone(request.status),
    type: request.initiatorType || "unknown",
    sourceLabel: networkSourceLabel(request.source, isResourceTiming),
    captureNote: isResourceTiming
      ? "Request method, headers, payload, and response body were not available from Resource Timing."
      : null,
    size: formatNetworkSize(request),
    time: formatMilliseconds(request.time),
    hasHeaders: hasRequestHeaders || hasResponseHeaders,
    hasPayload: Boolean(request.requestBody),
    hasResponse: Boolean(request.responseBody),
    requestHeaders: headerRows(request.requestHeaders),
    responseHeaders: headerRows(request.responseHeaders),
    requestBody: request.requestBody,
    responseBody: request.responseBody,
  };
}

function buildConsoleViewModel(logs: ShareSnapshot["console"]): ConsoleViewModel {
  const rows = [...logs]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((entry): ConsoleViewRow => {
      const text = normalizeConsoleText(entry.text);
      return {
        id: entry.id,
        type: entry.type,
        severity: entry.type === "error" ? "error" : entry.type === "warn" ? "warn" : "info",
        anchorId: anchorId("console", entry.id),
        message: firstLine(text),
        text,
        source: entry.source,
        frame: entry.frameUrl || "unknown frame",
        timestamp: formatTimestamp(entry.timestamp),
        isTop: typeof entry.isTop === "boolean" ? entry.isTop : null,
      };
    });

  return {
    rows,
    errorCount: logs.filter((entry) => entry.type === "error").length,
    warningCount: logs.filter((entry) => entry.type === "warn").length,
  };
}

function buildSourcesViewModel(cdp: CdpViewModel): SourcesViewModel {
  const groups = new Map<string, SourceTreeSection["rows"]>();
  const add = (type: string, url: string, safeUrl: string, duration = "unknown") => {
    const origin = originForUrl(url);
    const rows = groups.get(origin) ?? [];
    rows.push({ type, path: pathForUrl(url), duration, safeUrl });
    groups.set(origin, rows);
  };

  for (const asset of cdp.assets) add(asset.type, asset.url, asset.safeUrl);
  for (const resource of cdp.resources) add(resource.initiatorType, resource.url, resource.safeUrl, resource.duration);

  return {
    sections: [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([origin, rows], index) => ({
        anchorId: anchorId("resources", index + 1),
        origin,
        rows: rows.sort((a, b) => a.path.localeCompare(b.path)),
      })),
  };
}

function buildPerformanceViewModel(snapshot: ShareSnapshot, cdp: CdpViewModel): PerformanceViewModel {
  const diagnostics = snapshot.pageDiagnostics;
  const document = diagnostics?.document;
  const navigation = diagnostics?.navigation;

  return {
    documentRows: compactRows([
      detailRow("Ready State", document?.readyState),
      detailRow("Visibility", document?.visibilityState),
      detailRow("Online", typeof document?.online === "boolean" ? String(document.online) : undefined, "boolean"),
    ]),
    navigationRows: compactRows([
      detailRow("Navigation Type", navigation?.type),
      timingRow("Navigation Duration", navigation?.duration),
      timingRow("Response End", navigation?.responseEnd),
      timingRow("DOMContentLoaded", navigation?.domContentLoaded),
      timingRow("Load Event", navigation?.loadEvent),
    ]),
    paintRows: (diagnostics?.paints ?? [])
      .filter((paint) => typeof paint.name === "string" && typeof paint.startTime === "number")
      .map((paint) => ({ label: paint.name, value: formatMilliseconds(paint.startTime), valueType: "number" as const })),
    cdpRows: cdp.performanceRows,
    slowResources: cdp.resources.filter((resource) => durationNumber(resource.duration) >= 1000).slice(0, 8),
  };
}

function isResourceTimingRequest(request: NetworkRequestSnapshot): boolean {
  if (request.source === "resource-timing") return true;
  if (request.source === "devtools" || request.source === "page-intercept" || request.source === "web-request") return false;
  return (
    request.status === 0 &&
    Object.keys(request.requestHeaders).length === 0 &&
    Object.keys(request.responseHeaders).length === 0 &&
    request.requestBody === null &&
    request.responseBody === null
  );
}

function networkSourceLabel(source: NetworkRequestSnapshot["source"], isResourceTiming: boolean): string {
  if (isResourceTiming) return "Resource Timing";
  if (source === "page-intercept") return "Page Intercept";
  if (source === "web-request") return "Web Request";
  return "DevTools";
}

function networkStatusTone(status: number): StatusViewRow["tone"] {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  if (status >= 300) return "neutral";
  if (status > 0) return "ok";
  return "neutral";
}

function formatNetworkSize(request: NetworkRequestSnapshot): string {
  if (typeof request.transferSize === "number" && typeof request.decodedBodySize === "number") {
    return `${formatBytes(request.transferSize)} transferred / ${formatBytes(request.decodedBodySize)} decoded`;
  }
  if (typeof request.transferSize === "number") return `${formatBytes(request.transferSize)} transferred`;
  if (typeof request.decodedBodySize === "number") return `${formatBytes(request.decodedBodySize)} decoded`;
  if (request.responseBody) return formatBytes(byteLength(request.responseBody));
  if (request.requestBody) return formatBytes(byteLength(request.requestBody));
  return "unknown";
}

function headerRows(headers: Record<string, string>): NetworkHeaderViewRow[] {
  return Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }));
}

function timingRow(label: string, value: unknown): DetailViewRow | null {
  return typeof value === "number" && Number.isFinite(value)
    ? { label, value: formatMilliseconds(value), valueType: "number" }
    : null;
}

function durationNumber(value: string): number {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : 0;
}

function firstLine(value: string): string {
  return value.split(/\r?\n/)[0] || value;
}

function normalizeConsoleText(value: string): string {
  const trimmed = value.trim();
  const emptyError = trimmed.match(/^(Error|[A-Z][A-Za-z]*Error):$/);
  return emptyError?.[1] ?? value;
}

function buildStorageSections(storage: StorageSnapshot): StorageViewSection[] {
  return STORAGE_SECTIONS.map((section) => {
    const values = storage[section.id] ?? {};
    return {
      ...section,
      anchorId: `storage-${section.id}`,
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
      const result: CdpResourceViewRow = {
        initiatorType: typeof row.initiatorType === "string" && row.initiatorType ? row.initiatorType : "unknown",
        path: pathForUrl(row.name),
        duration,
        url: row.name,
        safeUrl: safeHttpUrl(row.name),
      };
      if (typeof row.transferSize === "number" && typeof row.decodedBodySize === "number") {
        result.size = `${formatBytes(row.transferSize)} transferred / ${formatBytes(row.decodedBodySize)} decoded`;
      } else if (typeof row.transferSize === "number") {
        result.size = `${formatBytes(row.transferSize)} transferred`;
      }
      if (typeof row.responseStatus === "number") {
        result.statusLabel = row.responseStatus > 0 ? String(row.responseStatus) : "Unknown";
      }
      return result;
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
        anchorId: "environment-browser",
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
        anchorId: "environment-device",
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
        anchorId: "environment-location",
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
        anchorId: "environment-extension",
        label: "Extension",
        rows: compactRows([
          detailRow("Extension ID", snapshot.extension.id),
          detailRow("Extension Version", snapshot.extension.version),
        ]),
      },
    ],
    installedExtensions: snapshot.installedExtensions.map((extension) => ({
      id: extension.id || "Redacted",
      name: extension.name,
      version: extension.version || "Redacted",
      enabled: extension.enabled ? "Enabled" : "Disabled",
      type: extension.type || "unknown",
      installType: extension.installType || "Redacted",
      permissions: extension.permissions ? pluralize(extension.permissions.length, "permission") : "Redacted",
      hostPermissions: extension.hostPermissions ? pluralize(extension.hostPermissions.length, "host permission") : "Redacted",
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

function formatCompactViewport(viewportValue: unknown): string | undefined {
  const viewport = asRecord(viewportValue);
  if (!viewport || typeof viewport.width !== "number" || typeof viewport.height !== "number") return undefined;
  return `${viewport.width}x${viewport.height}`;
}

function formatScreen(screenValue: unknown): string | undefined {
  const screen = asRecord(screenValue);
  if (!screen || typeof screen.width !== "number" || typeof screen.height !== "number") return undefined;
  const colorDepth = typeof screen.colorDepth === "number" ? `, ${screen.colorDepth}-bit color` : "";
  return `${screen.width} x ${screen.height}${colorDepth}`;
}

function formatMilliseconds(value: number): string {
  return `${Math.round(value)}ms`;
}

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value)) return "unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString("en-US", { hour12: false });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${Math.round(kib)} kB`;
  return `${(kib / 1024).toFixed(1)} MB`;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function pathForUrl(urlValue: string): string {
  try {
    const parsed = new URL(urlValue);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return urlValue;
  }
}

function originForUrl(urlValue: string): string {
  try {
    return new URL(urlValue).origin;
  } catch {
    return "unknown origin";
  }
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
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

function anchorId(prefix: string, value: string | number): string {
  return `${prefix}-${cssToken(String(value))}`;
}

function cssToken(value: string): string {
  const token = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return token || "item";
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

function compactBrowserLabel(name: string, version: string): string {
  const majorVersion = version.match(/^\d+/)?.[0] ?? "";
  return joinParts(name, majorVersion) || "Unknown browser";
}
