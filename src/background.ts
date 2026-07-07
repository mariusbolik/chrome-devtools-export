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
import {
  captureCdpSnapshot,
  normalizeInstalledExtensions,
  prepareSnapshotForUpload,
  uploadSnapshot,
} from "./share-snapshot";

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

  // Initialize if needed
  if (!tabLogs[tabId]) tabLogs[tabId] = [];
  if (!tabConnections[tabId]) tabConnections[tabId] = [];

  // Store log
  const log = message.data as ConsoleLogData;
  const entry: ConsoleLogEntry = {
    id: Date.now() + Math.random(),
    source: "content",
    ...log,
  };

  tabLogs[tabId].push(entry);

  // Limit stored logs
  if (tabLogs[tabId].length > 1000) {
    tabLogs[tabId] = tabLogs[tabId].slice(-1000);
  }

  // Forward to connected devtools panels
  tabConnections[tabId].forEach((port) => {
    try {
      port.postMessage({ type: "new-log", log: entry });
    } catch {
      // Port might be disconnected
    }
  });
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
  delete tabLogs[tabId];
  delete tabConnections[tabId];
  clearNetworkCaptureForTab(networkCapture, tabId);
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
  }, filter);
}
