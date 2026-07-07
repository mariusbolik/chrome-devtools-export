import { defineMiddleware } from "astro:middleware";
import { cacheableShareReadResponse, shareReadCacheRequest } from "./lib/share-cache";
import { trailingSlashRedirectTarget } from "./lib/trailing-slash";

export const onRequest = defineMiddleware(async (context, next) => {
  const target = trailingSlashRedirectTarget(context.url, context.request.method);
  if (target) return context.redirect(target, 308);

  const cacheRequest = shareReadCacheRequest(context.request);
  if (!cacheRequest || typeof caches === "undefined") return next();

  const cache = (caches as CacheStorage & { default?: Cache }).default;
  if (!cache) return next();
  const cached = await cache.match(cacheRequest);
  if (cached) return cached;

  const response = await next();
  if (!cacheableShareReadResponse(response)) return response;

  try {
    await cache.put(cacheRequest, response.clone());
  } catch (error) {
    console.warn("Share read cache write failed", error);
  }

  return response;
});
