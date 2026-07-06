import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { getSharedSnapshotJson, type ShareApiEnv } from "../../../lib/share-api";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  return getSharedSnapshotJson(params.id ?? "", env as unknown as ShareApiEnv);
};
