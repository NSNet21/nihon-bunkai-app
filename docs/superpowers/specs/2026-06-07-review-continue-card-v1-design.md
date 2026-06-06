<!-- cspell:disable -->

# Review Continue Card v1 Design

Date: 2026-06-07  
Status: approved in chat  
Decision: add one Browse hero review card, not a global queue

## Goal

Let learners see and enter due review directly from Browse, beside the existing Continue cards, without forcing them to find the due deck through the Library list or opening a global Review Queue.

## Scope

Include:

- A third Browse hero card when at least one ready deck has local due SRS cards.
- Copy pattern: `// REVIEW · รอทบทวน`, deck title, and `n รอทบทวน`.
- Pressing the card routes to `/deck/:deckId/quiz?review=due`.
- Pick one deck for v1:
  - prefer the due deck with the most recent completed session;
  - if none has a session, prefer the due deck with the highest due count;
  - tie-break by Browse deck order.
- Keep the existing Deck Preview `ทบทวน deck นี้` action unchanged.

Do not include:

- Global Review Queue.
- A list of all due decks.
- All-deck due review.
- Browse deck-row due badges.
- MC/Dictation due review.
- New SRS rules or Supabase sync changes.

## Data Boundary

Use local SRS state only:

- `cardStates` decides due counts.
- `sessionLogs` decides recency preference.
- ready Browse decks decide which due deck is visible.

The card should ignore due rows for decks that are not currently available in Browse. Malformed SRS row IDs should not crash the helper.

## UI Behavior

The Review card belongs to the existing Continue cluster. It should render after Learn Continue and Flashcard Continue, because review is related but distinct from resuming an unfinished session.

If no deck has due cards:

- do not render the Review card;
- do not show a disabled placeholder.

If a due card becomes non-due before the route loads, the existing Quiz Card no-due fallback from Deck Review Entry v1 handles it.

## Testing

Unit tests:

- select the most recently studied due deck.
- fall back to highest due count when no due deck has sessions.
- ignore due rows for unavailable decks.

Browser/visual check:

- seed one due deck in a temporary browser context.
- Browse shows `// REVIEW · รอทบทวน`.
- clicking opens `/quiz?review=due`.
- mobile and desktop have horizontal overflow `0` and console errors `0`.

## Watch-outs

- Do not expand this into a full Review Queue.
- Do not add expensive per-row due checks to the virtualized Browse list.
- Keep the card compact and visually aligned with existing Continue cards.

<!-- cspell:enable -->
