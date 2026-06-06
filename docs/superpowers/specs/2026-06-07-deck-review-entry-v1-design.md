# Deck Review Entry v1 Design

Date: 2026-06-07  
Status: approved concept, design written before implementation  
Decision: deck-local due review first

## Goal

Let learners act on the `รอทบทวน` signal shown by Deck Progress v1 without building a global Review Queue or Overall Progress dashboard.

V1 should add a small Deck Preview action that starts a Quiz Card session containing only due cards for that deck.

## Scope

Build Deck Review Entry v1 as a deck-local route mode.

Include:

- A small `ทบทวน deck นี้` action on Deck Preview when `dueCount > 0`.
- A route query such as `/deck/:deckId/quiz?review=due`.
- Quiz Card route filtering to local due entries for that deck.
- Existing Quiz Card FSRS rating behavior for reviewed cards.
- Existing session log behavior, with the session total reflecting the due subset.
- Quiet fallback if there are no due cards by the time the review route loads.

Do not include:

- Global Review Queue.
- All-deck due review.
- Overall Progress dashboard.
- New SRS scheduling rules.
- New study mode.
- MC/Dictation due-review routing.
- Supabase sync changes.

## User-Facing Placement

Place the action inside the Deck Progress block on Deck Preview, visually tied to the due badge.

Rules:

- Show the action only when `progress.dueCount > 0`.
- Keep it compact and secondary to the deck hero.
- Do not show a dead disabled button for decks without due cards.
- Copy should stay Thai-first:
  - `ทบทวน deck นี้`
  - due badge remains `n รอทบทวน`

## Route Behavior

Use the existing Quiz Card route:

```text
/deck/:deckId/quiz?review=due
```

The route should:

- Load all entries for the deck as today.
- Load local card states for the deck.
- Keep entries whose local FSRS state is due at route-load time.
- Preserve deck source order for due cards in v1.
- Ignore saved flashcard shuffle/count config for `review=due`.
- Keep `entryId` resume behavior higher priority than `review=due` if both are present, because `entryId` is an explicit deep link.

If no due entries are found:

- Show a small info toast such as `ยังไม่มีการ์ดที่ต้องทบทวนใน deck นี้`.
- Fall back to Deck Preview rather than silently starting a full-deck session.

## Data Boundary

Use local SRS state only.

Recommended helper addition in `src/lib/deck-progress.ts`:

```ts
async function getDueEntryNosForDeck(deckId: string, now = Date.now()): Promise<number[]>;
```

Why entry numbers:

- SRS `entryId` uses `makeEntryId(deckId, no)`, shaped like `deckId::no`.
- App route/display entries use `Entry.id`.
- Matching by entry number keeps this bridge explicit and avoids treating SRS row IDs as route IDs.

If a due SRS row refers to a deleted/missing entry number, the route should ignore it.

## Quiz Card Session Behavior

Due review is still Quiz Card.

Existing behavior should remain:

- Rating buttons write FSRS state.
- Completion writes session log and streak meta.
- In-card previous/next navigation works within the due subset.
- Manual reshuffle is allowed before rating if the due subset has more than one card, because it is still a fresh session.

V1 behavior:

- Session `totalCards` should be due subset length.
- `CARD x / y` should use due subset position.
- Back behavior should remain the normal direct deck flow: Quiz Card back returns to Deck Preview.
- Continue links do not need to preserve `review=due` in v1.

## Error Handling

If local SRS reads fail:

- Do not crash Quiz Card.
- Show the same no-due fallback toast and return to Deck Preview.
- In development, log a concise warning if this matches existing route patterns.

If due cards become non-due after the learner opens the route:

- Do not re-filter mid-session.
- The session snapshot is fixed at route load.

## Testing

Unit tests:

- Due entry helper returns only due rows for the requested deck.
- Due entry helper ignores future-due rows.
- Due entry helper parses `deckId::no` into numeric entry numbers.
- Due entry helper ignores malformed row IDs.

Route/browser smoke:

- Seed local due state for a known deck.
- Deck Preview shows `รอทบทวน` and `ทบทวน deck นี้`.
- Clicking the action opens `/quiz?review=due`.
- Quiz Card shows only the due subset count.
- Rating through the due subset completes without console errors.
- No horizontal overflow on mobile viewport.

Regression:

- `pnpm vitest run`
- `pnpm smoke:deck-route http://localhost:8097`
- `pnpm smoke:shuffle-session http://localhost:8097`
- `pnpm smoke:study-mode-fsrs http://localhost:8097`

## Watch-outs

- Do not build global Review Queue in this slice.
- Do not make MC/Dictation due-review behavior implicit.
- Do not treat SRS `entryId` as the same thing as route `Entry.id`.
- Do not mutate official/user content.
- Do not change FSRS scheduling math.
- Keep the DP progress block compact.

<!-- cspell:enable -->
