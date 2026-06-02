<!-- cspell:disable -->

# Import / Export Design

Date: 2026-06-02
Surface: `companion-app`
Roadmap phase: P1.2 Import / Batch Import, then P2.1 Export / Batch Export

## Goal

Add Browse-level Library actions so learners can manually import and export ready decks without mixing account/support settings into content workflows.

## Current Context

- Browse is the user-facing Library surface where ready decks appear.
- App-side entitlement download already imports signed ZIP content into IndexedDB through `download-store.ts` and `deck-import.ts`.
- Search, Deck Hub, Memorize, and Quiz read from `useAllDecks()` / `entriesForDeckAsync()`, which merge embedded free decks and IndexedDB deck records.
- Existing Browse rows show `OWNED` for `!deck.isFree`, so manual import must not simply masquerade as paid ownership without a clear source boundary.
- The production app must not bind the parent workspace `content/_csv-output` corpus into runtime. Manual import must come from user-selected files only.

## UX Placement

Import / Export belongs in Browse, not Settings.

Browse gets a compact Library action control near the hero/library controls. The control can be a `+` icon or icon+short label, depending on what fits without harming the current Browse rhythm.

Pressing it opens a modal/action sheet with four actions:

- Import one file
- Batch import
- Export one deck
- Batch export

The copy stays Thai-first. English verbs like `Import` and `Export` are acceptable as command labels when paired with short Thai helper text.

## MVP Import Behavior

Supported inputs:

- One CSV file.
- Multiple CSV files.
- One ZIP containing CSV files.

Supported CSV schema:

- Required headers: `NO,T,D,P,E`
- Header matching accepts uppercase official headers and lowercase variants internally. Exported official shape remains uppercase.

Supported official filename patterns:

- `vocab-n5-pack18.csv`
- `grammar-n4-pack01.csv`
- `kanji-n3-pack01.csv`
- `glossary-pack01.csv`
- Same files inside folders within ZIP, such as `vocab/vocab-n5-pack18.csv`.

Import result:

- Valid imported decks are saved to Local Library.
- Browse refreshes after import.
- Search can find imported entries.
- Deck Hub, Memorize, and Quiz can load imported decks.

Invalid files:

- Unsupported extension, missing required headers, empty CSV, or unknown filename pattern should produce clear user-facing errors.
- Batch import should continue valid files and report skipped/failed files, unless all files fail.

## MVP Export Behavior

Supported outputs:

- Export one selected ready deck as a CSV file.
- Batch export selected ready decks as a ZIP of CSV files.

Export schema:

- Always write `NO,T,D,P,E` in that order.
- Exported rows should preserve the visible entry content and not include progress, FSRS scheduling, entitlements, or account state.

Export scope:

- Default selector includes all ready decks: free embedded decks, paid imported official decks, and manual imported decks.
- Export does not grant ownership and does not change local Library state.

## Data Boundary

Manual imports need a distinct source identity from entitlement-backed imports.

MVP decision:

- Extend local deck records and normalized deck objects with `source: 'free' | 'entitlement' | 'manual'` before surfacing manual imports.
- Use the existing IndexedDB-backed Library path for ready deck records and rows so Browse/Search/Learn/Quiz keep one read path.
- Do not label manual imports as `OWNED`. Browse badges should distinguish at least:
  - free embedded content
  - entitlement-backed/imported official content
  - manual imported content

Badge copy:

- Free embedded decks: no badge, matching current visual restraint.
- Entitlement-backed official decks: `OWNED`.
- Manual imported decks: `IMPORT`.

## Duplicate Behavior

MVP duplicate rule:

- Same deck id import overwrites the existing local library copy after user confirmation in UI.
- In batch import, same-id files are counted as replacements and reported in the result summary.
- Embedded free official decks are not overwritten in the first pass. If a selected CSV has the same id as an embedded free deck, skip it and show that it was already included in the free Library.

## Architecture

Create focused modules rather than growing Browse into a parsing/storage file:

- Manual import parser / validator module.
- Manual export serializer module.
- Library action UI component or modal mounted from Browse.
- Small storage helpers if source/origin metadata requires schema adjustment.

First-pass implementation must not rewrite the signed-download import path. Shared pure parsing helpers may be introduced only when they are called by the new manual import/export modules and do not change signed-download behavior.

## Testing

Logic-first tests:

- CSV schema validation accepts valid `NO,T,D,P,E`.
- CSV schema validation rejects missing required columns.
- Filename parser creates correct deck metadata for vocab/grammar/kanji/glossary.
- ZIP import parses multiple CSV files and reports valid/invalid counts.
- Export serializer writes `NO,T,D,P,E` in order and preserves row values.

Browser interaction tests:

- Browse action opens the Library action modal.
- Import one CSV through file input.
- Batch import through file input or ZIP.
- Imported content appears in Browse.
- Imported content is searchable.
- Imported deck opens in Deck Hub, Memorize, and Quiz.
- Export one deck downloads a CSV.
- Batch export downloads a ZIP.

Perf guardrail:

- After implementation, run full-corpus browser smoke or equivalent to confirm Browse/Search still handle roughly 10k+ ready terms.

## Deferred

- Cloud backup or Google Drive backup.
- User-edited cards / personal override export.
- Supabase sync of manual imports.
- Cross-device sync for user-imported content.
- Deep Browse UI redesign beyond the Library action control.

## Approval Summary

This design follows the current direction:

- Import / Export in Browse.
- Individual and batch choices in UI.
- Backend/data logic first.
- Playwright flow for real user interaction.
- Keep production app runtime separate from parent `content/_csv-output`.

<!-- cspell:enable -->
