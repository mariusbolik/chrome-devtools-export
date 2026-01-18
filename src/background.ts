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

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab?.id) return;
  const tabId = sender.tab.id;

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

// Handle connections from devtools panels
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "devtools-panel") return;

  let tabId: number | null = null;

  port.onMessage.addListener((message) => {
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
});
