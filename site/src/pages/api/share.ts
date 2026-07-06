import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { handleCorsPreflight, handleCreateShare, type ShareApiEnv } from "../../lib/share-api";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  return handleCreateShare(request, env as unknown as ShareApiEnv, {
    cf: (request as Request & { cf?: IncomingRequestCfProperties }).cf,
  });
};

export const OPTIONS: APIRoute = async () => {
  return handleCorsPreflight();
};
