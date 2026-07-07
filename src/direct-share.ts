import type { ConsoleLogEntry } from "./types";
import type {
  CdpSnapshot,
  CreateSnapshotInput,
  EnvironmentSnapshot,
  InstalledExtensionSnapshot,
  NetworkRequestSnapshot,
  PageDiagnosticsSnapshot,
  ShareSnapshot,
  StorageSnapshot,
} from "../shared/snapshot";
import { mergeNetworkRequests } from "./network-capture";

export interface PageResourceCapture {
  name: string;
  initiatorType: string;
  duration: number;
  transferSize?: number;
  encodedBodySize?: number;
  decodedBodySize?: number;
  responseStatus?: number;
}

export interface PageAssetCapture {
  images: string[];
  scripts: string[];
  stylesheets: string[];
}

export interface PageCapture {
  url: string;
  title?: string;
  referrer?: string;
  userAgent?: string;
  viewport?: Record<string, unknown>;
  screen?: Record<string, unknown>;
  storage: StorageSnapshot;
  resources: PageResourceCapture[];
  pageDiagnostics?: PageDiagnosticsSnapshot;
  assets: PageAssetCapture;
  captureNotices?: ShareSnapshot["captureNotices"];
}

export interface DirectSnapshotInputOptions {
  id: string;
  page: PageCapture;
  extension: ShareSnapshot["extension"];
  environment: EnvironmentSnapshot;
  installedExtensions: InstalledExtensionSnapshot[];
  consoleLogs: ConsoleLogEntry[];
  cdp: CdpSnapshot;
  networkRequests?: NetworkRequestSnapshot[];
}

export function buildDirectSnapshotInput(options: DirectSnapshotInputOptions): CreateSnapshotInput {
  return {
    id: options.id,
    url: options.page.url,
    title: options.page.title,
    referrer: options.page.referrer,
    extension: options.extension,
    environment: {
      ...options.environment,
      userAgent: options.page.userAgent || options.environment.userAgent,
      screen: options.page.screen,
      viewport: options.page.viewport,
    },
    pageDiagnostics: options.page.pageDiagnostics,
    installedExtensions: options.installedExtensions,
    captureNotices: options.page.captureNotices,
    network: mergeNetworkRequests(options.networkRequests ?? [], options.page.resources.map(resourceToNetworkRequest)),
    console: options.consoleLogs.map((entry) => ({ ...entry, source: entry.source ?? "content" })),
    storage: options.page.storage,
    cdp: {
      ...options.cdp,
      pageAssets: options.page.assets,
      pageResources: options.page.resources,
    },
  };
}

function resourceToNetworkRequest(resource: PageResourceCapture, index: number): NetworkRequestSnapshot {
  return {
    id: index + 1,
    method: "UNKNOWN",
    url: resource.name,
    status: typeof resource.responseStatus === "number" ? resource.responseStatus : 0,
    time: Math.round(resource.duration || 0),
    source: "resource-timing",
    initiatorType: resource.initiatorType,
    requestHeaders: {},
    responseHeaders: {},
    requestBody: null,
    responseBody: null,
    ...(typeof resource.transferSize === "number" ? { transferSize: resource.transferSize } : {}),
    ...(typeof resource.encodedBodySize === "number" ? { encodedBodySize: resource.encodedBodySize } : {}),
    ...(typeof resource.decodedBodySize === "number" ? { decodedBodySize: resource.decodedBodySize } : {}),
  };
}
