const FILE_EXTENSION_PATTERN = /\/[^/]+\.[^/]+$/;
const REDIRECTABLE_METHODS = new Set(["GET", "HEAD"]);

export function trailingSlashRedirectTarget(url: URL, method = "GET"): string | null {
  if (!REDIRECTABLE_METHODS.has(method.toUpperCase())) return null;
  if (!shouldRedirectPath(url.pathname)) return null;

  const next = new URL(url);
  next.pathname = `${url.pathname}/`;
  return next.toString();
}

function shouldRedirectPath(pathname: string): boolean {
  if (pathname === "/" || pathname.endsWith("/")) return false;
  if (pathname.startsWith("/api/") || pathname === "/api") return false;
  if (pathname.startsWith("/_astro/")) return false;
  if (FILE_EXTENSION_PATTERN.test(pathname)) return false;
  return true;
}
