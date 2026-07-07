import { defineMiddleware } from "astro:middleware";
import { trailingSlashRedirectTarget } from "./lib/trailing-slash";

export const onRequest = defineMiddleware((context, next) => {
  const target = trailingSlashRedirectTarget(context.url, context.request.method);
  if (target) return context.redirect(target, 308);
  return next();
});
