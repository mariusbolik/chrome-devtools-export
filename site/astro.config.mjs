import cloudflare from "@astrojs/cloudflare";
import { defineConfig, sessionDrivers } from "astro/config";

export default defineConfig({
  adapter: cloudflare({
    imageService: "passthrough",
  }),
  devToolbar: {
    enabled: false,
  },
  // Suppress the automatic KV-backed SESSION binding injected by @astrojs/cloudflare.
  session: {
    driver: sessionDrivers.lruCache(),
  },
  output: "server",
});
