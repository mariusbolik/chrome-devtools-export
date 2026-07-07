import {
  SHARE_APP_URL_BLOCK_MESSAGE,
  buildShareId,
  isShareAppUrl,
  type CdpSnapshot,
  type InstalledExtensionSnapshot,
} from "../shared/snapshot";
import { buildDirectSnapshotInput, type PageCapture } from "./direct-share";
import {
  clearNetworkCaptureForTab,
  createNetworkCaptureStore,
  getCapturedNetworkRequests,
  recordBeforeRequest,
  recordCompleted,
  recordErrorOccurred,
  recordHeadersReceived,
  recordPageNetworkEntry,
  recordSendHeaders,
} from "./network-capture";
import { networkFailureConsoleEntry } from "./network-console";
import {
  captureCdpSnapshot,
  normalizeInstalledExtensions,
  prepareSnapshotForUpload,
  uploadSnapshot,
} from "./share-snapshot";
import { shouldSuppressConsoleLog } from "./console-filter";
import { normalizeConsoleText } from "./console-format";

// Background service worker - relays console logs between content scripts and devtools panels

interface ConsoleLogData {
  type: "log" | "info" | "warn" | "error" | "debug";
  text: string;
  timestamp: number;
  args?: unknown[];
  isTop?: boolean;
  frameUrl?: string;
}

interface ConsoleLogEntry extends ConsoleLogData {
  id: number;
  source: "content";
}

// Store logs per tab (simple object for service worker persistence)
const tabLogs: Record<number, ConsoleLogEntry[]> = {};
const tabConnections: Record<number, chrome.runtime.Port[]> = {};
const networkCapture = createNetworkCaptureStore(500);
const networkConsoleLogKeys: Record<number, Set<string>> = {};
const pendingShareRequests: Record<
  string,
  {
    resolve: (response: ShareResponseMessage) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  }
> = {};

type ShareResponseMessage =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; error: string };

interface ShareActiveTabOptions {
  includeScreenshot: boolean;
}

void reinjectContentBridgeIntoOpenTabs();
chrome.runtime.onInstalled.addListener(() => {
  void reinjectContentBridgeIntoOpenTabs();
});
chrome.runtime.onStartup.addListener(() => {
  void reinjectContentBridgeIntoOpenTabs();
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "share-active-tab") {
    shareActiveTab(message.tabId as number, {
      includeScreenshot: message.includeScreenshot !== false,
    })
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Share failed",
        });
      });
    return true;
  }

  if (!sender.tab?.id) return;
  const tabId = sender.tab.id;

  if (message.type === "network-log") {
    recordPageNetworkEntry(networkCapture, tabId, message.data);
    return;
  }

  if (message.type !== "console-log") return;

  const log = message.data as ConsoleLogData;
  const entry: ConsoleLogEntry = {
    ...log,
    id: Date.now() + Math.random(),
    source: "content",
    text: normalizeConsoleText(log.text),
  };
  if (shouldSuppressConsoleLog(entry)) return;
  storeConsoleLog(tabId, entry);
});

async function shareActiveTab(tabId: number, options: ShareActiveTabOptions): Promise<ShareResponseMessage> {
  try {
    const page = await collectPageCapture(tabId);
    if (isShareAppUrl(page.url)) {
      throw new Error(SHARE_APP_URL_BLOCK_MESSAGE);
    }

    const [installedExtensions, cdp] = await Promise.all([
      collectInstalledExtensions(),
      captureCdpSnapshot(tabId, { includeScreenshot: options.includeScreenshot }).catch((error): CdpSnapshot => ({
        errors: [error instanceof Error ? error.message : "CDP capture failed"],
      })),
    ]);

    const prepared = prepareSnapshotForUpload(
      buildDirectSnapshotInput({
        id: buildShareId(),
        page,
        extension: collectExtensionMetadata(),
        environment: collectRuntimeEnvironment(page),
        installedExtensions,
        consoleLogs: tabLogs[tabId] ?? [],
        networkRequests: getCapturedNetworkRequests(networkCapture, tabId),
        cdp,
      }),
      { includeScreenshot: options.includeScreenshot }
    );
    const share = await uploadSnapshot(prepared.snapshot, undefined, { includeScreenshot: options.includeScreenshot });

    return {
      ok: true,
      url: share.url,
      expiresAt: share.expiresAt,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not capture this tab.",
    };
  }
}

async function collectPageCapture(tabId: number): Promise<PageCapture> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "collect-page-snapshot" }) as PageCapture | { error?: string };
    if ("error" in response && response.error) throw new Error(response.error);
    return response as PageCapture;
  } catch (error) {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !/^https?:\/\//.test(tab.url)) {
      throw new Error("This page cannot be captured. Try an http or https tab.");
    }
    return {
      url: tab.url,
      title: tab.title,
      referrer: "",
      userAgent: navigator.userAgent,
      storage: {
        localStorage: {},
        sessionStorage: {},
        cookies: {},
        indexedDB: {},
      },
      resources: [],
      assets: {
        images: [],
        scripts: [],
        stylesheets: [],
      },
      captureNotices: [
        {
          path: "page",
          reason: error instanceof Error ? `Content script capture failed: ${error.message}` : "Content script capture failed; uploaded tab metadata only",
        },
        {
          path: "storage",
          reason: "Storage was not available because page capture fell back to tab metadata",
        },
        {
          path: "network",
          reason: "Resource timing was not available because page capture fell back to tab metadata",
        },
      ],
    };
  }
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

function collectExtensionMetadata() {
  const manifest = chrome.runtime.getManifest();
  return {
    id: chrome.runtime.id,
    version: manifest.version,
  };
}

function collectRuntimeEnvironment(page: PageCapture) {
  const nav = navigator as Navigator & {
    userAgentData?: {
      brands?: Array<{ brand: string; version: string }>;
      mobile?: boolean;
      platform?: string;
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

async function reinjectContentBridgeIntoOpenTabs(): Promise<void> {
  if (!chrome.scripting?.executeScript) return;

  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["content-bridge.js"],
        });
      } catch {
        // Some pages reject extension script injection; normal content_script matching will handle future loads.
      }
    })
  );
}

async function requestShareFromPanel(tabId: number): Promise<ShareResponseMessage> {
  const ports = tabConnections[tabId] ?? [];
  const port = ports.at(-1);

  if (!port) {
    return {
      ok: false,
      error: "Open DevTools and select the Export panel first.",
    };
  }

  const requestId = `${Date.now()}-${Math.random()}`;
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      delete pendingShareRequests[requestId];
      resolve({ ok: false, error: "Share timed out. Try again from the Export panel." });
    }, 120_000);

    pendingShareRequests[requestId] = { resolve, timeoutId };
    try {
      port.postMessage({ type: "share-request", requestId });
    } catch {
      clearTimeout(timeoutId);
      delete pendingShareRequests[requestId];
      resolve({ ok: false, error: "DevTools Export panel is not connected." });
    }
  });
}

// Handle connections from devtools panels
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "devtools-panel") return;

  let tabId: number | null = null;

  port.onMessage.addListener((message) => {
    if (message.type === "share-response") {
      const requestId = message.requestId as string;
      const pending = pendingShareRequests[requestId];
      if (!pending) return;
      clearTimeout(pending.timeoutId);
      delete pendingShareRequests[requestId];
      pending.resolve(message.response as ShareResponseMessage);
      return;
    }

    if (message.type === "init") {
      tabId = message.tabId as number;

      // Initialize if needed
      if (!tabLogs[tabId]) tabLogs[tabId] = [];
      if (!tabConnections[tabId]) tabConnections[tabId] = [];

      tabConnections[tabId].push(port);

      // Send existing logs
      port.postMessage({ type: "init-logs", logs: tabLogs[tabId] });
    } else if (message.type === "clear" && tabId !== null) {
      tabLogs[tabId] = [];
    }
  });

  port.onDisconnect.addListener(() => {
    if (tabId !== null && tabConnections[tabId]) {
      tabConnections[tabId] = tabConnections[tabId].filter((p) => p !== port);
    }
  });
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabConnections[tabId];
  resetTabCapture(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    resetTabCapture(tabId, { notifyPanels: true });
  }
});

if (chrome.webRequest) {
  const filter: chrome.webRequest.RequestFilter = { urls: ["<all_urls>"] };
  chrome.webRequest.onBeforeRequest.addListener((details) => {
    recordBeforeRequest(networkCapture, details);
  }, filter, ["requestBody"]);
  chrome.webRequest.onSendHeaders.addListener((details) => {
    recordSendHeaders(networkCapture, details);
  }, filter, ["requestHeaders"]);
  chrome.webRequest.onHeadersReceived.addListener((details) => {
    recordHeadersReceived(networkCapture, details);
  }, filter, ["responseHeaders"]);
  chrome.webRequest.onCompleted.addListener((details) => {
    recordCompleted(networkCapture, details);
  }, filter, ["responseHeaders"]);
  chrome.webRequest.onErrorOccurred.addListener((details) => {
    recordErrorOccurred(networkCapture, details);
    setTimeout(() => forwardFailedNetworkConsoleLog(details), 100);
  }, filter);
}

function storeConsoleLog(tabId: number, entry: ConsoleLogEntry): void {
  if (!tabLogs[tabId]) tabLogs[tabId] = [];
  if (!tabConnections[tabId]) tabConnections[tabId] = [];

  tabLogs[tabId].push(entry);
  if (tabLogs[tabId].length > 1000) {
    tabLogs[tabId] = tabLogs[tabId].slice(-1000);
  }

  tabConnections[tabId].forEach((port) => {
    try {
      port.postMessage({ type: "new-log", log: entry });
    } catch {
      // Port might be disconnected.
    }
  });
}

function resetTabCapture(tabId: number, options: { notifyPanels?: boolean } = {}): void {
  delete tabLogs[tabId];
  delete networkConsoleLogKeys[tabId];
  clearNetworkCaptureForTab(networkCapture, tabId);

  if (!options.notifyPanels) return;
  tabConnections[tabId]?.forEach((port) => {
    try {
      port.postMessage({ type: "tab-reset" });
    } catch {
      // Port might be disconnected.
    }
  });
}

function forwardFailedNetworkConsoleLog(details: chrome.webRequest.WebResponseErrorDetails): void {
  if (details.tabId < 0) return;
  if (!networkConsoleLogKeys[details.tabId]) networkConsoleLogKeys[details.tabId] = new Set();

  const key = `${details.requestId}:${details.error}`;
  if (networkConsoleLogKeys[details.tabId].has(key)) return;

  const method = "method" in details && typeof details.method === "string" ? details.method.toUpperCase() : "UNKNOWN";
  const request = getCapturedNetworkRequests(networkCapture, details.tabId)
    .filter((item) => item.url === details.url && item.method === method && item.error === details.error)
    .at(-1);
  if (!request) return;

  const extra = details as chrome.webRequest.WebResponseErrorDetails & { documentUrl?: string; initiator?: string };
  const entry = networkFailureConsoleEntry(request, {
    id: Date.now() + Math.random(),
    timestamp: details.timeStamp,
    frameUrl: extra.documentUrl ?? extra.initiator ?? details.url,
  });
  if (!entry) return;

  networkConsoleLogKeys[details.tabId].add(key);
  storeConsoleLog(details.tabId, entry);
}
