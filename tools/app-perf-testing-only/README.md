# App Perf Testing Only

This folder contains local QA/performance harnesses for the Nihon Bunkai app.

These scripts are not app runtime code:

- Do not import files from this folder into `src/`.
- Do not use these scripts as production import/unlock logic.
- Do not add routes or UI that call these scripts.
- These scripts are intended for local Playwright/Node verification only.

`full-corpus-browser-smoke.mjs` reads the real local CSV corpus from the parent
workspace `content/_csv-output` and seeds paid deck/entry records into the
temporary Playwright browser IndexedDB context. It does not grant Supabase
entitlements, does not fetch paid content from production storage, and does not
enter the Expo web production bundle.

Use it to verify that Browse, Search, Deck Hub, Memorize, and Quiz stay smooth
with the full paid-corpus shape.
