import type { ConsoleLogEntry, NetworkRequest } from "./types";
import { shareDevtoolsSnapshot } from "./share-snapshot";

// State
let networkRequests: NetworkRequest[] = [];
let networkFilter = "";
let consoleLogs: ConsoleLogEntry[] = [];
let consoleFilter = "";
const inspectedTabId = chrome.devtools.inspectedWindow.tabId;
let consolePort: chrome.runtime.Port | null = null;
let consoleIncludeIframes = true;

// DOM helpers
const $ = (id: string) => document.getElementById(id)!;
const $$ = (sel: string) => document.querySelectorAll(sel);

// Toast
function toast(msg: string) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2000);
}

// Clipboard
async function copy(text: string) {
  const isDevtools = location.protocol === "devtools:";
  const canUseClipboard =
    !isDevtools && typeof navigator !== "undefined" && !!navigator.clipboard && window.isSecureContext;

  if (canUseClipboard) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied!");
      return;
    } catch {
      // Fall back to execCommand for environments that block Clipboard API.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const ok = document.execCommand("copy");
    toast(ok ? "Copied!" : "Copy failed");
  } catch {
    toast("Copy failed");
  } finally {
    textarea.remove();
  }
}

// Download
function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  toast("Downloaded!");
}

const ICON_COPY = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="10" height="10" rx="1.5" fill="currentColor" opacity="0.5"></rect><rect x="9" y="9" width="10" height="10" rx="1.5" fill="currentColor"></rect></svg>`;
const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20L18 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 4V16M12 16L15.5 12.5M12 16L8.5 12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

// ============ TABS ============
function initTabs() {
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $$(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(tab.getAttribute("data-tab")!).classList.add("active");
    });
  });
}

// ============ SHARE ============
function initShare() {
  const modal = $("shareModal");
  const status = $("shareStatus");
  const result = $("shareResult") as HTMLAnchorElement;
  const includeSensitive = $("shareIncludeSensitive") as HTMLInputElement;
  const includeScreenshot = $("shareIncludeScreenshot") as HTMLInputElement;
  const confirm = $("shareConfirm") as HTMLButtonElement;

  const setOpen = (open: boolean) => {
    modal.hidden = !open;
    if (open) {
      status.textContent = "Ready to capture";
      result.classList.remove("show");
      result.removeAttribute("href");
      result.textContent = "";
      includeSensitive.checked = false;
      includeScreenshot.checked = true;
      confirm.disabled = false;
    }
  };

  $("shareSnapshot").addEventListener("click", () => setOpen(true));
  $("shareCancel").addEventListener("click", () => setOpen(false));
  modal.querySelector(".modal-backdrop")?.addEventListener("click", () => setOpen(false));

  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    result.classList.remove("show");
    status.textContent = "Capturing DevTools snapshot...";

    try {
      const share = await shareDevtoolsSnapshot({
        inspectedTabId,
        networkRequests,
        consoleLogs,
        includeSensitive: includeSensitive.checked,
        includeScreenshot: includeScreenshot.checked,
      });
      result.href = share.url;
      result.textContent = share.url;
      result.classList.add("show");
      status.textContent = `Shared until ${new Date(share.expiresAt).toLocaleString()}`;
      await copy(share.url);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Share failed";
      confirm.disabled = false;
    }
  });
}

// ============ CONSOLE ============
function initConsole() {
  $("consoleFilter").addEventListener("input", (e) => {
    consoleFilter = (e.target as HTMLInputElement).value.toLowerCase();
    renderConsole();
  });

  $("consoleIncludeIframes").addEventListener("change", (e) => {
    consoleIncludeIframes = (e.target as HTMLInputElement).checked;
    renderConsole();
  });

  $("clearConsole").addEventListener("click", () => {
    consoleLogs = [];
    renderConsole();
    consolePort?.postMessage({ type: "clear" });
  });

  $("exportAllConsole").addEventListener("click", () => {
    download(`console-${Date.now()}.json`, consoleLogs);
  });

  connectConsolePort();
  renderConsole();
}

function addConsoleEntry(entry: ConsoleLogEntry) {
  consoleLogs.unshift(entry);
  if (consoleLogs.length > 1000) consoleLogs.length = 1000;
  renderConsole();
}

function connectConsolePort() {
  try {
    consolePort = chrome.runtime.connect({ name: "devtools-panel" });
  } catch {
    toast("Console capture unavailable");
    return;
  }

  consolePort.onMessage.addListener((message) => {
    if (message.type === "init-logs") {
      consoleLogs = (message.logs as ConsoleLogEntry[]) ?? [];
      renderConsole();
      return;
    }

    if (message.type === "new-log") {
      addConsoleEntry(message.log as ConsoleLogEntry);
      return;
    }

    if (message.type === "share-request") {
      const requestId = message.requestId as string;
      void shareDevtoolsSnapshot({
        inspectedTabId,
        networkRequests,
        consoleLogs,
        includeScreenshot: true,
      })
        .then((share) => {
          consolePort?.postMessage({
            type: "share-response",
            requestId,
            response: {
              ok: true,
              url: share.url,
              expiresAt: share.expiresAt,
            },
          });
        })
        .catch((error) => {
          consolePort?.postMessage({
            type: "share-response",
            requestId,
            response: {
              ok: false,
              error: error instanceof Error ? error.message : "Share failed",
            },
          });
        });
    }
  });

  consolePort.postMessage({ type: "init", tabId: inspectedTabId });

  window.addEventListener("beforeunload", () => {
    consolePort?.disconnect();
  });
}

function renderConsole() {
  const list = $("consoleList");
  const filtered = consoleLogs.filter((entry) => {
    if (!consoleFilter) return true;
    return (
      entry.text.toLowerCase().includes(consoleFilter) ||
      entry.type.toLowerCase().includes(consoleFilter)
    );
  });
  const frameFiltered = consoleIncludeIframes
    ? filtered
    : filtered.filter((entry) => entry.isTop !== false);

  if (!frameFiltered.length) {
    list.innerHTML = `<div class="empty">No console logs captured</div>`;
    return;
  }

  list.innerHTML = frameFiltered
    .map(
      (entry) => `
    <div class="log-item ${entry.type}">
      <span class="type">${entry.type}</span>
      <span class="message">${escapeHtml(entry.text || "")}</span>
      <div class="actions">
        <button class="action-btn" data-action="copy" data-id="${entry.id}" title="Copy">${ICON_COPY}</button>
        <button class="action-btn" data-action="download" data-id="${entry.id}" title="Download">${ICON_DOWNLOAD}</button>
      </div>
    </div>
  `
    )
    .join("");

  list.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseFloat((btn as HTMLElement).dataset.id!);
      const entry = consoleLogs.find((log) => log.id === id);
      if (!entry) return;
      const action = (btn as HTMLElement).dataset.action;
      if (action === "copy") {
        copy(entry.text);
      } else if (action === "download") {
        download(`console-${entry.id}.json`, entry);
      }
    });
  });
}

// ============ NETWORK ============
function initNetwork() {
  chrome.devtools.network.onRequestFinished.addListener((req) => {
    req.getContent((content) => {
      const headers = (arr: { name: string; value: string }[]) =>
        Object.fromEntries(arr.map((h) => [h.name, h.value]));

      networkRequests.unshift({
        id: Date.now() + Math.random(),
        method: req.request.method,
        url: req.request.url,
        status: req.response.status,
        time: Math.round(req.time || 0),
        source: "devtools",
        requestHeaders: headers(req.request.headers),
        responseHeaders: headers(req.response.headers),
        requestBody: req.request.postData?.text || null,
        responseBody: content,
      });

      if (networkRequests.length > 500) networkRequests.length = 500;
      renderNetwork();
    });
  });

  $("networkFilter").addEventListener("input", (e) => {
    networkFilter = (e.target as HTMLInputElement).value.toLowerCase();
    renderNetwork();
  });

  $("clearNetwork").addEventListener("click", () => {
    networkRequests = [];
    renderNetwork();
  });

  $("refreshNetwork").addEventListener("click", renderNetwork);

  $("exportAllNetwork").addEventListener("click", () => {
    download(`network-${Date.now()}.json`, networkRequests);
  });

  renderNetwork();
}

function renderNetwork() {
  const list = $("networkList");
  const filtered = networkRequests.filter(
    (r) =>
      r.url.toLowerCase().includes(networkFilter) ||
      r.method.toLowerCase().includes(networkFilter)
  );

  if (!filtered.length) {
    list.innerHTML = `<div class="empty">No requests captured</div>`;
    return;
  }

  list.innerHTML = filtered
    .map(
      (r) => `
    <div class="net-item" data-id="${r.id}">
      <span class="method ${r.method.toLowerCase()}">${r.method}</span>
      <span class="status ${r.status < 300 ? "ok" : r.status < 400 ? "redirect" : "error"}">${r.status}</span>
      <span class="url">${new URL(r.url).pathname}</span>
      <div class="actions">
        <button class="action-btn" data-action="copy" title="Copy">${ICON_COPY}</button>
        <button class="action-btn" data-action="download" title="Download">${ICON_DOWNLOAD}</button>
      </div>
    </div>
  `
    )
    .join("");

  list.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseFloat((btn.closest(".net-item") as HTMLElement).dataset.id!);
      const req = networkRequests.find((r) => r.id === id)!;
      const action = (btn as HTMLElement).dataset.action;

      if (action === "copy") {
        copy(JSON.stringify(req, null, 2));
      } else if (action === "download") {
        download(`request-${req.id}.json`, req);
      }
    });
  });
}

// ============ STORAGE ============
function initStorage() {
  $("refreshStorage").addEventListener("click", fetchStorage);

  $$(".export-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const type = (btn as HTMLElement).dataset.type!;
      exportStorage(type);
    });
  });

  fetchStorage();
}

function fetchStorage() {
  chrome.devtools.inspectedWindow.eval(
    "JSON.stringify(Object.fromEntries(Object.entries(localStorage)))",
    (result) => {
      try {
        renderStorageData("localStorageData", JSON.parse(result as string));
      } catch {
        renderStorageData("localStorageData", {});
      }
    }
  );

  chrome.devtools.inspectedWindow.eval(
    "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))",
    (result) => {
      try {
        renderStorageData("sessionStorageData", JSON.parse(result as string));
      } catch {
        renderStorageData("sessionStorageData", {});
      }
    }
  );

  chrome.devtools.inspectedWindow.eval(
    `JSON.stringify(Object.fromEntries(document.cookie.split('; ').filter(Boolean).map(c => c.split('='))))`,
    (result) => {
      try {
        renderStorageData("cookiesData", JSON.parse(result as string));
      } catch {
        renderStorageData("cookiesData", {});
      }
    }
  );

  chrome.devtools.inspectedWindow.eval(
    `(async () => {
      try {
        const dbs = await indexedDB.databases();
        return JSON.stringify(dbs.map(db => ({ name: db.name, version: db.version })));
      } catch { return '[]'; }
    })()`,
    (result) => {
      try {
        const dbs = JSON.parse(result as string);
        const el = $("indexedDBData");
        if (!dbs.length) {
          el.innerHTML = `<div class="empty">No databases</div>`;
        } else {
          el.innerHTML = dbs
            .map(
              (db: { name: string; version: number }) =>
                `<div class="storage-row"><span class="key">${db.name}</span><span class="value">v${db.version}</span></div>`
            )
            .join("");
        }
      } catch {
        renderStorageData("indexedDBData", {});
      }
    }
  );
}

function renderStorageData(id: string, data: Record<string, unknown>) {
  const el = $(id);
  const entries = Object.entries(data);

  if (!entries.length) {
    el.innerHTML = `<div class="empty">Empty</div>`;
    return;
  }

  el.innerHTML = entries
    .map(
      ([k, v]) =>
        `<div class="storage-row"><span class="key">${escapeHtml(k)}</span><span class="value">${escapeHtml(String(v))}</span></div>`
    )
    .join("");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function exportStorage(type: string) {
  const scripts: Record<string, string> = {
    localStorage: "JSON.stringify(Object.fromEntries(Object.entries(localStorage)))",
    sessionStorage: "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))",
    cookies: `JSON.stringify(Object.fromEntries(document.cookie.split('; ').filter(Boolean).map(c => c.split('='))))`,
    indexedDB: `(async () => {
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
    })()`,
  };

  chrome.devtools.inspectedWindow.eval(scripts[type], (result) => {
    try {
      download(`${type}-${Date.now()}.json`, JSON.parse(result as string));
    } catch {
      toast("Export failed");
    }
  });
}

// ============ INIT ============
initTabs();
initShare();
initConsole();
initNetwork();
initStorage();
