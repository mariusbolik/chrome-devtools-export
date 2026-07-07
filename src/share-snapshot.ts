import type { ConsoleLogEntry } from "./types";
import {
  SNAPSHOT_SCHEMA_VERSION,
  SHARE_APP_URL_BLOCK_MESSAGE,
  buildShareId,
  createSnapshot,
  isShareAppUrl,
  redactSnapshot,
  trimSnapshotToBytes,
  type CreateSnapshotInput,
  type CdpSnapshot,
  type InstalledExtensionSnapshot,
  type NetworkRequestSnapshot,
  type ShareSnapshot,
  type StorageSnapshot,
} from "../shared/snapshot";
import { withNetworkFailureConsoleLogs } from "./network-console";

export const SHARE_ENDPOINT = "https://devtoolsexport.com/api/share";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface PrepareOptions {
  includeSensitive?: boolean;
  includeScreenshot?: boolean;
  maxBytes?: number;
}

export interface ShareSnapshotOptions extends PrepareOptions {
  inspectedTabId: number;
  networkRequests: NetworkRequestSnapshot[];
  consoleLogs: ConsoleLogEntry[];
  uploadEndpoint?: string;
}

export interface ShareResponse {
  id: string;
  url: string;
  expiresAt: string;
}

export interface UploadOptions {
  includeSensitive?: boolean;
  includeScreenshot?: boolean;
}

export interface CaptureCdpOptions {
  includeScreenshot?: boolean;
}

export function normalizeInstalledExtensions(
  extensions: chrome.management.ExtensionInfo[]
): InstalledExtensionSnapshot[] {
  return extensions.map((extension) => ({
    id: extension.id,
    name: extension.name,
    version: extension.version,
    enabled: extension.enabled,
    type: extension.type,
    installType: extension.installType,
    permissions: extension.permissions,
    hostPermissions: extension.hostPermissions,
  }));
}

export function prepareSnapshotForUpload(
  input: CreateSnapshotInput,
  options: PrepareOptions = {}
): { snapshot: ShareSnapshot } {
  if (isShareAppUrl(input.url)) {
    throw new Error(SHARE_APP_URL_BLOCK_MESSAGE);
  }

  const snapshot = createSnapshot(input);
  const redacted = redactSnapshot(snapshot, {
    includeSensitive: options.includeSensitive === true,
    includeScreenshot: options.includeScreenshot === true,
  }).snapshot;
  const trimmed = trimSnapshotToBytes(redacted, options.maxBytes ?? MAX_UPLOAD_BYTES).snapshot;
  return { snapshot: trimmed };
}

export async function shareDevtoolsSnapshot(options: ShareSnapshotOptions): Promise<ShareResponse> {
  const page = await collectPageMetadata();
  if (isShareAppUrl(page.url)) {
    throw new Error(SHARE_APP_URL_BLOCK_MESSAGE);
  }

  const [storage, installedExtensions, cdp] = await Promise.all([
    collectStorageSnapshot(),
    collectInstalledExtensions(),
    captureCdpSnapshot(options.inspectedTabId, { includeScreenshot: options.includeScreenshot }),
  ]);

  const prepared = prepareSnapshotForUpload(
    {
      id: buildShareId(),
      url: page.url,
      title: page.title,
      referrer: page.referrer,
      extension: collectExtensionMetadata(),
      environment: collectRuntimeEnvironment(page),
      installedExtensions,
      network: options.networkRequests,
      console: withNetworkFailureConsoleLogs(options.consoleLogs, options.networkRequests, page.url).map((entry) => ({ ...entry, source: entry.source ?? "content" })),
      storage,
      cdp,
    },
    options
  );

  return uploadSnapshot(prepared.snapshot, options.uploadEndpoint ?? SHARE_ENDPOINT, {
    includeSensitive: options.includeSensitive === true,
    includeScreenshot: options.includeScreenshot === true,
  });
}

export async function uploadSnapshot(
  snapshot: ShareSnapshot,
  endpoint = SHARE_ENDPOINT,
  options: UploadOptions = {}
): Promise<ShareResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-devtools-export-schema": SNAPSHOT_SCHEMA_VERSION,
      "x-devtools-export-include-sensitive": String(options.includeSensitive === true),
      "x-devtools-export-include-screenshot": String(options.includeScreenshot === true),
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as ShareResponse;
}

async function collectInstalledExtensions(): Promise<InstalledExtensionSnapshot[]> {
  if (!chrome.management?.getAll) return [];
  return new Promise((resolve) => {
    chrome.management.getAll((extensions) => {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      resolve(normalizeInstalledExtensions(extensions));
    });
  });
}

function collectExtensionMetadata(): ShareSnapshot["extension"] {
  const manifest = chrome.runtime.getManifest();
  return {
    id: chrome.runtime.id,
    version: manifest.version,
  };
}

function collectRuntimeEnvironment(page: PageMetadata): ShareSnapshot["environment"] {
  const nav = navigator as Navigator & {
    userAgentData?: {
      brands?: Array<{ brand: string; version: string }>;
      mobile?: boolean;
      platform?: string;
      getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
    };
    deviceMemory?: number;
  };

  return {
    userAgent: page.userAgent || navigator.userAgent,
    language: navigator.language,
    languages: [...navigator.languages],
    platform: nav.userAgentData?.platform || navigator.platform,
    vendor: navigator.vendor,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: page.screen,
    viewport: page.viewport,
    browser: {
      userAgentData: nav.userAgentData
        ? {
            brands: nav.userAgentData.brands,
            mobile: nav.userAgentData.mobile,
            platform: nav.userAgentData.platform,
          }
        : undefined,
    },
  };
}

interface PageMetadata {
  url: string;
  title?: string;
  referrer?: string;
  userAgent?: string;
  viewport?: Record<string, unknown>;
  screen?: Record<string, unknown>;
}

async function collectPageMetadata(): Promise<PageMetadata> {
  return evalInInspectedWindow<PageMetadata>(`(() => JSON.stringify({
    url: location.href,
    title: document.title,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    },
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    }
  }))()`);
}

async function collectStorageSnapshot(): Promise<StorageSnapshot> {
  const [localStorage, sessionStorage, cookies, indexedDB] = await Promise.all([
    evalInInspectedWindow<Record<string, string>>(
      "JSON.stringify(Object.fromEntries(Object.entries(localStorage)))"
    ),
    evalInInspectedWindow<Record<string, string>>(
      "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))"
    ),
    evalInInspectedWindow<Record<string, string>>(
      `JSON.stringify(Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((cookie) => {
        const index = cookie.indexOf('=');
        return index === -1 ? [cookie, ''] : [cookie.slice(0, index), cookie.slice(index + 1)];
      })))`
    ),
    evalInInspectedWindow<Record<string, unknown>>(`(async () => {
      const result = {};
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        const conn = await new Promise((resolve, reject) => {
          const req = indexedDB.open(db.name);
          req.onsuccess = () => resolve(req.result);
          req.onerror = reject;
        });
        result[db.name] = { version: db.version, stores: Array.from(conn.objectStoreNames) };
        conn.close();
      }
      return JSON.stringify(result);
    })()`),
  ]);

  return {
    localStorage,
    sessionStorage,
    cookies,
    indexedDB,
  };
}

function evalInInspectedWindow<T>(expression: string): Promise<T> {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      if (exceptionInfo) {
        resolve({} as T);
        return;
      }

      try {
        resolve(typeof result === "string" ? (JSON.parse(result) as T) : (result as T));
      } catch {
        resolve({} as T);
      }
    });
  });
}

export async function captureCdpSnapshot(tabId: number, options: CaptureCdpOptions = {}): Promise<CdpSnapshot> {
  const target: chrome.debugger.Debuggee = { tabId };
  await attachDebugger(target);

  const cdp: CdpSnapshot = { errors: [] };
  try {
    await sendCommand(target, "Page.enable");
    await sendCommand(target, "Runtime.enable");
    await sendCommand(target, "Performance.enable");

    cdp.layoutMetrics = await safeCommand(target, "Page.getLayoutMetrics", undefined, cdp.errors);
    cdp.performanceMetrics = await safeCommand(target, "Performance.getMetrics", undefined, cdp.errors);
    if (options.includeScreenshot === true) {
      const screenshot = await safeCommand<{ data?: string }>(
        target,
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: false },
        cdp.errors
      );
      if (screenshot?.data) cdp.screenshotDataUrl = `data:image/png;base64,${screenshot.data}`;
    }
    cdp.domSnapshot = await safeCommand(
      target,
      "DOMSnapshot.captureSnapshot",
      { computedStyles: [] },
      cdp.errors
    );
    cdp.cookies = await safeCommand(target, "Network.getCookies", undefined, cdp.errors);
    cdp.target = { tabId };
    return cdp;
  } finally {
    await detachDebugger(target);
  }
}

function attachDebugger(target: chrome.debugger.Debuggee): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(target, "1.3", () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || "Unable to attach Chrome debugger"));
        return;
      }
      resolve();
    });
  });
}

function detachDebugger(target: chrome.debugger.Debuggee): Promise<void> {
  return new Promise((resolve) => {
    chrome.debugger.detach(target, () => resolve());
  });
}

function sendCommand<T = unknown>(
  target: chrome.debugger.Debuggee,
  method: string,
  commandParams?: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, commandParams, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || `${method} failed`));
        return;
      }
      resolve(result as T);
    });
  });
}

async function safeCommand<T = unknown>(
  target: chrome.debugger.Debuggee,
  method: string,
  commandParams: Record<string, unknown> | undefined,
  errors: string[] | undefined
): Promise<T | undefined> {
  try {
    return await sendCommand<T>(target, method, commandParams);
  } catch (error) {
    errors?.push(error instanceof Error ? `${method}: ${error.message}` : `${method}: failed`);
    return undefined;
  }
}
