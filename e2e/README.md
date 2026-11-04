# Playwright e2e suite

Runs against the production build served by `vite preview` (see
`../playwright.config.js`). From the repo root:

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers npm run e2e          # both projects
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers npx playwright test e2e/export.spec.js --project=desktop-chromium
```

## Layout

| File | Covers |
|---|---|
| `upload.spec.js` | add 3 screens, non-image rejection, remove, reset |
| `layouts.spec.js` | vertical/horizontal/collage natural sizes, mixed sizes, long-image mode |
| `export.spec.js` | PNG/JPEG/WebP download magic bytes + extension + PNG/JPEG dimensions + caption |
| `settings.spec.js` | disclosure open/close/Escape/focus return/outside click, margin+gap output size |
| `error.spec.js` | extreme aspect-ratio error (`role=alert`), retry |
| `privacy.spec.js` | zero requests outside `127.0.0.1:5199` / `data:` / `blob:` while uploading + exporting |
| `mobile.spec.js` | Pixel 7: no horizontal overflow, bottom-sheet settings, download reachable |
| `sprint-a.spec.js` | session restore/clear, undo/redo/Delete/Ctrl+S, preview fit modes, settings memory + reset |

## Conventions

- `helpers/app.js` — fixtures, upload/settle/result-size helpers, settings panel,
  `runOnlyIn(project)` and `waitForSessionSaved`.
- `helpers/downloads.js` — `downloadAndRead` plus PNG/JPEG magic + dimension parsers.
- Functional specs run in `desktop-chromium` only (`runOnlyIn`); viewport-specific
  checks live in `mobile.spec.js` and run in `mobile-chromium` only.
- Every test gets a fresh browser context; no test depends on another's storage.
- Prefer role/label/text selectors; `.thumb`, `.result-image`, `.output-meta`,
  `.stage` are the only CSS-internal hooks.
