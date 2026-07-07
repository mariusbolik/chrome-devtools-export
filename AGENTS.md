# Agent Notes

## Project Overview

- This repo contains a Chrome MV3 extension plus an Astro/Cloudflare Worker share site.
- The extension captures DevTools-style debugging data: console logs, network/resource timing, storage metadata, installed extensions, environment details, CDP data, and optional screenshots.
- The share site stores snapshots in Cloudflare R2 and renders them at `https://devtools-export.mcb-software.workers.dev/share/<id>/`.
- The intended custom domain is `devtoolsexport.com`, but the active deployed Worker URL is currently `https://devtools-export.mcb-software.workers.dev`.

## Important Paths

- `src/`: extension TypeScript sources.
- `shared/`: schema, snapshot creation, redaction, trimming, validation shared by extension and site.
- `popup.html`, `popup.css`, `src/popup.ts`, `src/popup-state.ts`: toolbar popup.
- `panel.html`, `panel.css`, `src/panel.ts`: DevTools panel UI.
- `manifest.json`: Chrome extension manifest.
- `build.ts`: extension build script.
- `dist/`: generated unpacked extension loaded into Chrome.
- `site/`: Astro 7 + Cloudflare Workers share site.
- `site/src/lib/share-api.ts`: upload/read API and R2 persistence.
- `site/src/lib/share-view.ts`: share page view models.
- `site/src/pages/share/[id]/index.astro`: rendered share page.

## Build And Test

- Root tests: `bun test`.
- Extension build: `bun run build`.
- Root typecheck: `bunx tsc --noEmit`.
- Site checks from `site/`: `bun run check && bun run build && bun test`.
- Site deploy from `site/`: `bun run deploy`.

## Extension Build Rule

- When changing the Chrome extension, always run `bun run build` before finishing so `dist/` is regenerated.
- Treat changes to `src/`, `shared/`, `manifest.json`, `popup.*`, `panel.*`, `devtools.html`, `assets/`, or `build.ts` as Chrome extension changes.
- Chrome testing should load the unpacked extension from `dist/`.
- After rebuilding, verify relevant generated files exist in `dist/`, especially `popup.html`, `popup.js`, `background.js`, and `manifest.json` for popup/share changes.

## Share Flow

- Toolbar popup sends `share-active-tab` to `src/background.ts`.
- Background captures active tab data, installed extensions, console logs, and CDP details.
- Popup has an `Include Screenshot` checkbox enabled by default.
- Screenshots are captured only when requested and are uploaded with `x-devtools-export-include-screenshot: true`.
- The server still redacts other sensitive data unless `x-devtools-export-include-sensitive: true` is explicitly used.
- Share URLs are returned from `/api/share` and read back from `/api/share/<id>.json`.

## Privacy And Redaction

- Default behavior must redact secrets, request/response bodies, cookies, CDP cookies, DOM snapshots, and sensitive query params.
- Screenshot inclusion is separate from full sensitive inclusion. Do not use `includeSensitive` just to show screenshots.
- If no screenshot exists, the share page should not show a screenshot placeholder or "redacted" screenshot state.
- Keep raw JSON available as a fallback, but prefer UI sections for human review.

## Cloudflare

- Worker name: `devtools-export`.
- R2 bucket: `devtools-export-shares`.
- `site/wrangler.toml` sets `remote = true` on the `SNAPSHOTS` R2 binding so local dev can read/write the remote bucket.
- Share objects are stored under `snapshots/<id>.json`.
- The Worker enforces expiry at read time; R2 lifecycle also expires old snapshots.
- Use `.env` Cloudflare credentials already present in the workspace when deploying.

## UI Expectations

- Match the existing DevTools-like dark UI.
- Keep the share page sticky region as header + summary metrics + tabs.
- Share page title should be `DevToolsExport #<id>`.
- Header includes a live countdown until the share link expires.
- Storage, DOM/CDP, and Environment should be rendered as UI, with raw JSON only as a fallback.

## Notes About Captured Console Errors

- `content-main.js` wraps console methods to capture logs. When page scripts log errors, stack traces may include `content-main.js`.
- That does not automatically mean the extension caused the error; check the originating stack frames and page URLs first.
