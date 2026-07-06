import type { ConsoleLogEntry } from "./types";
import type {
  CdpSnapshot,
  CreateSnapshotInput,
  EnvironmentSnapshot,
  InstalledExtensionSnapshot,
  NetworkRequestSnapshot,
  ShareSnapshot,
  StorageSnapshot,
} from "../shared/snapshot";

export interface PageResourceCapture {
  name: string;
  initiatorType: string;
  duration: number;
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
  assets: PageAssetCapture;
}

export interface DirectSnapshotInputOptions {
  id: string;
  page: PageCapture;
  extension: ShareSnapshot["extension"];
  environment: EnvironmentSnapshot;
  installedExtensions: InstalledExtensionSnapshot[];
  consoleLogs: ConsoleLogEntry[];
  cdp: CdpSnapshot;
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
    installedExtensions: options.installedExtensions,
    network: options.page.resources.map(resourceToNetworkRequest),
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
    method: "GET",
    url: resource.name,
    status: 0,
    time: Math.round(resource.duration || 0),
    requestHeaders: {},
    responseHeaders: {},
    requestBody: null,
    responseBody: null,
  };
}
