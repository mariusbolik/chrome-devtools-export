window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || (event.data.type !== "DEVTOOLS_EXPORT_LOG" && event.data.type !== "DEVTOOLS_EXPORT_NETWORK")) return;
  if (!event.data.data || typeof event.data.data !== "object") return;

  try {
    chrome.runtime.sendMessage({
      type: event.data.type === "DEVTOOLS_EXPORT_NETWORK" ? "network-log" : "console-log",
      data: event.data.data,
    });
  } catch {
    // Ignore messaging errors (e.g. extension unloaded)
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "collect-page-snapshot") return;

  collectPageSnapshot()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        error: error instanceof Error ? error.message : "Page capture failed",
      });
    });
  return true;
});

async function collectPageSnapshot() {
  return {
    url: location.href,
    title: document.title,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
    },
    storage: {
      localStorage: readStorage(localStorage),
      sessionStorage: readStorage(sessionStorage),
      cookies: readCookies(),
      indexedDB: await readIndexedDBMetadata(),
    },
    resources: readResourceTimings(),
    pageDiagnostics: readPageDiagnostics(),
    assets: {
      images: unique(Array.from(document.images).map((image) => image.currentSrc || image.src).filter(Boolean)),
      scripts: unique(Array.from(document.scripts).map((script) => script.src).filter(Boolean)),
      stylesheets: unique(
        Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'))
          .map((link) => link.href)
          .filter(Boolean)
      ),
    },
  };
}

function readResourceTimings() {
  return performance.getEntriesByType("resource").map((entry) => {
    const resource = entry as PerformanceResourceTiming;
    return {
      name: resource.name,
      initiatorType: resource.initiatorType,
      duration: resource.duration,
      transferSize: resource.transferSize,
      encodedBodySize: resource.encodedBodySize,
      decodedBodySize: resource.decodedBodySize,
      responseStatus: resource.responseStatus,
    };
  });
}

function readPageDiagnostics() {
  return {
    document: {
      readyState: document.readyState,
      visibilityState: document.visibilityState,
      online: navigator.onLine,
    },
    navigation: readNavigationTiming(),
    paints: performance.getEntriesByType("paint").map((entry) => ({
      name: entry.name,
      startTime: entry.startTime,
    })),
  };
}

function readNavigationTiming() {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!navigation) return undefined;

  return {
    type: navigation.type,
    duration: navigation.duration,
    domContentLoaded: navigation.domContentLoadedEventEnd,
    loadEvent: navigation.loadEventEnd,
    responseEnd: navigation.responseEnd,
  };
}

function readStorage(storage: globalThis.Storage): Record<string, string> {
  try {
    return Object.fromEntries(Object.entries(storage));
  } catch {
    return {};
  }
}

function readCookies(): Record<string, string> {
  try {
    return Object.fromEntries(
      document.cookie
        .split("; ")
        .filter(Boolean)
        .map((cookie) => {
          const index = cookie.indexOf("=");
          return index === -1 ? [cookie, ""] : [cookie.slice(0, index), cookie.slice(index + 1)];
        })
    );
  } catch {
    return {};
  }
}

async function readIndexedDBMetadata(): Promise<Record<string, unknown>> {
  try {
    const result: Record<string, unknown> = {};
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (!db.name) continue;
      const conn = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(db.name!);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      result[db.name] = { version: db.version, stores: Array.from(conn.objectStoreNames) };
      conn.close();
    }
    return result;
  } catch {
    return {};
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

const injectMainScript = () => {
  if (document.documentElement.getAttribute("data-devtools-export-logger") === "true") return;
  document.documentElement.setAttribute("data-devtools-export-logger", "true");

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("content-main.js");
  script.async = false;
  script.onerror = () => {
    document.documentElement.removeAttribute("data-devtools-export-logger");
  };
  if (document.head) {
    document.head.appendChild(script);
  } else if (document.documentElement) {
    document.documentElement.appendChild(script);
  } else {
    return;
  }
  script.onload = () => script.remove();
};

injectMainScript();

try {
  chrome.runtime.sendMessage({ type: "console-bridge-ready" });
} catch {
  // Ignore messaging errors (e.g. extension unloaded)
}
