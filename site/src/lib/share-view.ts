import type { ShareSnapshot } from "../../../shared/snapshot";

export interface ShareViewModel {
  id: string;
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
}

const BROWSER_ICON_BASE = "https://cdn.jsdelivr.net/gh/alrra/browser-logos@main/src";
const FLAG_BASE = "https://cdn.jsdelivr.net/npm/flagpack@1.0.5/flags/1x1";

export function buildShareViewModel(snapshot: ShareSnapshot): ShareViewModel {
  const browserName = readString(snapshot.environment.browser, ["browser", "name"]);
  const browserVersion = readString(snapshot.environment.browser, ["browser", "version"]);
  const country = String(snapshot.environment.cloudflare?.country ?? "unknown").toUpperCase();
  const city = String(snapshot.environment.cloudflare?.city ?? "");

  return {
    id: snapshot.id,
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
  };
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
