# Agent Notes

- When changing the Chrome extension, always run `bun run build` before finishing so `dist/` is regenerated.
- Treat changes to `src/`, `shared/`, `manifest.json`, `popup.*`, `panel.*`, `devtools.html`, `assets/`, or `build.ts` as Chrome extension changes.
- Chrome testing should load the unpacked extension from `dist/`.
