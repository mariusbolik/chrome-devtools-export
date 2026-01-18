<p align="center">
  <img src="assets/icon/icon.png" width="96" height="96" alt="DevTools Export icon" />
</p>

<h1 align="center">Chrome DevTools Export</h1>

Export Network requests, Console logs, and Storage data directly from a custom Chrome DevTools panel.

![Screenshot](screenshot-1.png)

## Features

- **Network**: Capture requests with headers, bodies, and response data
- **Console**: Capture page console logs and errors
- **Storage**: Export localStorage, sessionStorage, cookies, and IndexedDB
- **Export**: Copy or download entries as JSON
- **Filter**: Filter network and console entries
- **Iframes**: Toggle iframe log capture in Console tab

## Install (Developer Mode)

1. Build the extension:
   ```bash
   bun run build
   ```
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `dist` folder.
4. Open DevTools and select the **Export** panel.

## Usage

- **Network tab**: Click copy or download on a request.
- **Console tab**: Click copy or download on a log entry.
- **Storage tab**: Click **Export** for a storage type.

## Permissions

- `host_permissions: <all_urls>` is required to capture console logs from the page context.

## Build

- Source: `src/`
- Build output: `dist/`

## Notes

- Some pages may block or override console hooks; results can vary.
- Restricted URLs (e.g. `chrome://`, Chrome Web Store) won’t be capturable.

## License

MIT
