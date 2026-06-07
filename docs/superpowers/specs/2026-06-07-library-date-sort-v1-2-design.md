<!-- cspell:disable -->

# Library Date Sort v1.2 Design

## Goal

Make Browse Library sorting match learner expectations: sorting should organize the visible library shelf by group/section date or name, while preserving official learning order where that order carries meaning.

## Decisions

- Replace the current `Terms` sort mode with `Date`.
- Keep `Default` as the existing official/user hierarchy order.
- Keep official JLPT groups in their learning order only for `Default`.
- Outside `Default`, sort top-level groups by the selected mode/direction so user/import groups can move above official groups when that is the expected shelf order.
- For user-created/imported groups, `Name` sorts groups and sections by title.
- `Date` uses real local deck timestamps:
  - new/imported decks get `createdAt` and `updatedAt`;
  - re-import/re-download preserves the first `createdAt`;
  - re-import/re-download updates `updatedAt`;
  - group/section date is derived from the newest child deck timestamp.
- Deck rows stay in their current deck order for `Name`, because official/user deck names often encode learning sequence such as `Pack 01`.
- For `Date`, deck rows can sort by deck timestamp inside the current section.
- Browse sort does not sort term rows and does not change Deck Preview term ordering.
- Grid view remains deferred.

## Data Model

`Deck` already supports optional `createdAt` and `updatedAt`. The import/download IndexedDB record also has `importedAt`. The v1.2 foundation treats:

- `createdAt`: first time the deck entered the Local Library or was created.
- `updatedAt`: latest import/download/metadata/content change.
- `importedAt`: compatibility field for older local records and current storage table shape.

Existing records without `createdAt` should be backfilled lazily when saved again, and sort fallback should treat `createdAt ?? importedAt ?? updatedAt ?? 0` as the deck date.

## Behavior

- `Default`: current Browse order with official groups first and official JLPT learning order preserved.
- `Name Asc/Desc`: top-level groups sort by title. Sections sort by title inside groups. Deck rows preserve incoming/default order.
- `Date Asc/Desc`: top-level groups, sections, and deck rows use newest child deck timestamp for ordering. Official embedded groups without timestamps behave as oldest (`0`), so `Date Desc` can put newer user/import groups above `N5`/`GLOSSARY`.
- Selecting `Default` resets direction to `asc` as v1.1 already does.

## Testing

- Unit tests for timestamp merge behavior in download-store.
- Unit tests for manual import parse output carrying timestamps.
- Unit tests for Browse row building with `Name` and `Date` sort options.
- Existing sort helper tests updated from `Terms` to `Date`.
- Browser visual check for Browse sort menu and no horizontal overflow on mobile/desktop.

<!-- cspell:enable -->
