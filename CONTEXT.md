<!-- cspell:disable -->

# Companion App Context

This context defines user-facing learning, ownership, locking, and study language inside the Nihon Bunkai Companion App. Use these terms when changing app UI, routes, state names, copy, entitlement behavior, or study flows.

## Learning Content

**Deck**:
A user-facing unit of study content in the app, grouped by content type, JLPT level, and deck sequence. A deck contains multiple entries and may originate from a CSV pack, but it is not the same thing as a CSV pack or a purchase entitlement.
_Avoid_: CSV pack, file, entitlement

**Entry**:
A single learnable content object inside a deck, such as one glossary term, grammar pattern, kanji item, or vocab item.
_Avoid_: Card, row, object

**Term**:
The learner-facing idea of one item to learn or review. In many app contexts, a term maps closely to one entry, but Term is content language while Entry is the data unit.
_Avoid_: Card, file row

**Card**:
The UI representation of a single entry or term in browse, memorize, quiz, or review surfaces.
_Avoid_: Entry as data, deck

**Content Type**:
The category of content a deck belongs to: Glossary, Grammar, Kanji, or Vocab.
_Avoid_: Subject, collection type

**JLPT Level**:
The N-level grouping for app content, from N5 through N1.
_Avoid_: Difficulty, tier

**Browse**:
The app's main ready-to-use library/home surface where usable terms and decks are listed for study. Browse is where imported, embedded, or otherwise ready content becomes visible to the learner.
_Avoid_: Shop, search-only page, raw catalog

**Search**:
The app capability for finding something the user needs, such as terms, decks, or future searchable objects.
_Avoid_: Term Search only, Browse hierarchy

**Search Pill**:
A compact, input-like navigation control that opens the real Search route. On mobile Browse, the Search Pill sits in the top bar beside the wordmark, uses a search-bar surface, shows crimson active/focus feedback, briefly lingers before navigation, and then focuses the Search route input. It is not an inline Browse filter.
_Avoid_: Search button, search nav button, inline search field

**Group Search**:
A Browse/Library modal search for finding groups, sub-groups, and decks by metadata such as level, content type, deck title, source, pack/id, or tags. Group Search shows hierarchy-aware results and opens the selected deck's learning hub. It does not search individual terms/entries and stays separate from Term Search.
_Avoid_: Section Search, inline Browse filter, Term Search, Search Pill, global search

**Term Search**:
The current search surface for finding ready-to-learn terms across available entries, decks, content types, and levels by query.
_Avoid_: All future search features, locked catalog search

**Search Scope**:
The set of content a search feature is allowed to search. For Term Search, this means ready-to-learn entries and can grow past 10,000 terms when all levels are available.
_Avoid_: Raw source data, locked-only catalog

**Search Corpus**:
Technical alias for Search Scope when discussing search/index implementation.
_Avoid_: User-facing copy

**Catalog**:
The official Nihon Bunkai content/product set the app knows about, including free, paid, locked, and owned official content.
_Avoid_: User Content, Custom Deck, local library

**Library**:
The content currently usable in the app, including official ready content and user-imported content.
_Avoid_: Official catalog only, shop catalog

**Local Library**:
Durable local app storage for ready content, including downloaded/imported official content and user-imported content.
_Avoid_: Temporary cache, raw source files

**Offline-first**:
The app behavior where learning uses local Library data after content has been downloaded or imported, so Browse, Learn, Quiz, and Review can work without network.
_Avoid_: Buying or downloading new content while offline

**Cache**:
Temporary browser/app storage that may be cleared by the platform or user.
_Avoid_: Durable library, user backup

**Cache Reset**:
Clearing local browser/app storage. This can affect Local Library, progress, personal edits, or custom decks, so it must be treated differently from harmless temporary-cache cleanup.
_Avoid_: Safe no-op, account deletion

**Re-download**:
Downloading official CSV content again through the app because the user's Content Entitlement still exists.
_Avoid_: New purchase, restoring local-only user edits

**Backup Warning**:
User-facing warning that local-only personal edits, custom decks, or user-imported content may need manual backup before reset, migration, or device changes.
_Avoid_: Official content entitlement warning

**User Content**:
Content imported or created by the user from outside the official Nihon Bunkai catalog.
_Avoid_: Official catalog content, entitlement-backed content

**Custom Deck**:
A user-created or user-imported deck that is not part of the official Nihon Bunkai catalog.
_Avoid_: Official deck, sales pack

**Official Source**:
Immutable Nihon Bunkai source content. User edits must not mutate this source.
_Avoid_: User Override, Personal Edit

**Library Copy**:
The user's local usable copy of official or imported content inside the app library.
_Avoid_: Official Source, source JSON

**Personal Edit**:
A user modification made for personal learning, such as adjusting wording, notes, fields, or display preferences on their own library content.
_Avoid_: Official source edit, resale right

**User Override**:
A local overlay or patch that changes how an entry/card appears for that user without changing the official source.
_Avoid_: Mutating official content, synced term source

**Reset to Original**:
Removing a user override so the official source content is shown again.
_Avoid_: Delete official content

**Manual Backup**:
A user-initiated export/import or storage flow for preserving user-owned data, such as personal edits or custom decks.
_Avoid_: Auto sync, Supabase term sync

**Google Drive Backup**:
A manual backup/restore target concept using the user's own Google Drive storage.
_Avoid_: Automatic sync requirement, app-owned cloud storage

**Sync**:
Ambiguous shorthand that the user may use for either app state sync or user data backup. Clarify from context before implementing.
_Avoid_: Assuming auto sync, assuming term-source sync

**App State Sync**:
Supabase-backed sync for account/app state that should survive across devices.
_Avoid_: User-edited term sync, custom deck sync

**User Progress Data Sync**:
Sync for learning progress data such as progress, review state, SRS/FSRS scheduling state, session logs, and streak/meta.
_Avoid_: User content backup, official source sync

**Entitlement Sync**:
Sync for ownership/unlock state, entitlement grants, and restore-purchase behavior.
_Avoid_: User content backup, Payhip as source of truth

**User Data Backup**:
Manual export/import backup for user-owned data such as personal edits, custom decks, or user content.
_Avoid_: App State Sync, realtime auto sync

**Language Toggle**:
A deferred app feature for switching UI/copy between Thai and English.
_Avoid_: Default requirement for every new MVP feature

**Thai-first**:
The current app language posture: Thai is the primary practical UI/copy language while core features are still moving.
_Avoid_: Full bilingual support assumption

**Login Polish**:
A deferred polish lane for improving login/auth UX after higher-priority functional work is stable.
_Avoid_: Blocking core feature implementation, auth architecture rewrite

**Visual QA**:
Checking implemented UI for concrete visual defects such as overlap, text overflow, broken spacing, broken mobile layout, unreadable contrast, or screenshot mismatch.
_Avoid_: Open-ended redesign

**Regression Check**:
Checking that previously working app pages, flows, UI states, data paths, or behavior still work after a change.
_Aliases_: app regression
_Avoid_: New feature validation only, open-ended redesign, visual preference pass

**Full Regression Check**:
A broader regression pass across multiple important app routes, states, viewports, data paths, and flows after a risky or large change.
_Aliases_: overall app regression, Deep Regression Pass
_Avoid_: Quick Check, isolated feature check, open-ended redesign

**UI Polish**:
Refining the visual feel and interface composition, such as spacing rhythm, hierarchy, button weight, copy density, and empty states.
_Avoid_: Functional feature work, Visual QA defect pass

**UX Polish**:
Refining workflows and interactions so user states, errors, retries, and next actions are clearer.
_Avoid_: Pure visual styling, new feature scope

**Shop**:
The app surface for official catalog packs/SKUs, ownership state, entitlement-aware download actions, and links out to Payhip checkout.
_Avoid_: Browse, Payhip storefront replacement, library

**Payhip Checkout**:
The external checkout/product-hosting flow used to complete purchases and provide PDF downloads.
_Avoid_: App Shop, official landing storefront

**Payhip**:
The external checkout, product-hosting, and PDF download system.
_Avoid_: Entitlement source of truth, app backend

**Supabase**:
The app backend and source of truth for purchase records, content entitlements, and app-side unlock state.
_Avoid_: Checkout storefront, PDF download host

**Payhip Order**:
The purchase event/evidence produced by Payhip checkout.
_Avoid_: Content Entitlement, app unlock state

**Purchase Record**:
The app/backend record of a purchase event, used to support entitlement grant and restore flows.
_Avoid_: Entitlement, downloadable content

**SKU**:
An internal sales/payment identifier the app may use to map catalog items, entitlements, and download actions.
_Avoid_: User-facing product name, deck name

**Ready**:
An internal state meaning content is available for app use after being embedded or imported.
_Avoid_: Entitled, downloaded

**In Browse**:
User-facing copy meaning the content is ready and can be found on the Browse page.
_Avoid_: Ready as primary UI copy

**Multi-deck Study**:
User-facing name for studying several ready decks together in one session.
_Avoid_: Group Study as primary UI copy, multiplayer study

**Deck Group Session**:
The internal/product-flow concept behind Multi-deck Study: a temporary study session made from multiple selected decks.
_Avoid_: Bundle, sales pack, permanent deck merge

## Study Modes

**Mode Picker**:
The deck-level surface where a learner chooses Flashcard, Multiple Choice, or Dictation after opening a deck and reviewing its term list.
_Avoid_: Deck Hub, game launcher

**Memorize**:
The study mode for learning or self-reviewing entries by revealing and recalling answers. It is the canonical product term for the app's memorization-oriented flow.
_Avoid_: Quiz, test

**Learn**:
UI/translation-layer alias for Memorize, especially in Thai-facing copy where the learner reads it as `เรียน`.
_Avoid_: Separate mode from Memorize

**Quiz**:
The study mode for answering prompts with clearer correctness, result, or scoring behavior than Memorize.
_Avoid_: Memorize, Learn

**Quiz Variant**:
A variant of Quiz that changes answer input style or prompt mechanics without becoming a separate top-level study mode.
_Aliases_: Quiz Mode
_Avoid_: Top-level mode sprawl

**Multiple Choice**:
A Quiz Variant where the learner selects an answer from choices.
_Avoid_: Separate top-level mode, Memorize

**Dictation**:
A Quiz Variant where the learner types or reconstructs an answer from listening/recall.
_Avoid_: Separate top-level mode, Memorize

**Quiz Config**:
Pre-session quiz settings such as card count, quiz variant, shuffle behavior, deck selection, or future filters.
_Avoid_: Global app settings, permanent deck config

**Settings**:
The app surface for user/app preferences and account utilities, such as theme, auth/account actions, restore purchases, backup/import/export tools, privacy/account deletion, and future language toggle.
_Avoid_: Browse/Search content navigation, per-session Quiz Config

**Account**:
The user's Supabase-backed app identity/auth profile used for login, entitlement sync, restore purchase, and app state sync.
_Avoid_: Payhip customer, purchase record, local library

**Profile**:
User-facing account metadata or preferences, such as display information, onboarding state, or app preferences.
_Avoid_: Entitlement, purchase record, Payhip customer

**Onboarding**:
The first-run flow that introduces the app, captures basic learner intent, or guides the user toward the initial app experience.
_Avoid_: Login, entitlement, tutorial forever

**Onboarding State**:
Whether the user has already completed or dismissed onboarding.
_Avoid_: Ownership state, progress state

**Onboarding Polish**:
A future UX refinement lane for improving the onboarding funnel, first-run clarity, and transition into Browse/Shop/Search.
_Avoid_: Blocking core feature work unless onboarding prevents practical use

**Account Deletion**:
The request or process for deleting account/profile/auth-related app data.
_Avoid_: Irrecoverable loss of purchase evidence, automatic content refund

**Synced Session Deletion**:
Deleting synced session/progress state associated with the account.
_Avoid_: Deleting official source content, deleting Payhip order history

**Delete Account**:
Deleting backend account/profile/auth-related data.
_Avoid_: Delete Local Data, automatic purchase erasure

**Delete Local Data**:
Deleting local device/app data such as Local Library, cache, progress, personal edits, user overrides, user imports, or custom decks.
_Avoid_: Delete Account, server-side deletion

**Delete Synced Data**:
Deleting app state synced to backend, such as progress/session/review state.
_Avoid_: Delete Local Data, deleting Payhip order history

**Restore Purchase**:
Recovering purchased content entitlement using prior purchase evidence or a restore identifier.
_Avoid_: New purchase, PDF download

**Automatic Restore**:
Restore behavior that can happen without manual support when the app can match account, email, order, pending grant, or restore identifier.
_Avoid_: Guaranteed restore for every case

**Manual Restore**:
Restore behavior that requires support review when automatic matching fails.
_Avoid_: New purchase, instant restore promise

**Restore Identifier**:
An identifier separate from email credentials that may help recover purchases or entitlements, such as an order ID or app/payment-generated ID.
_Avoid_: Password, email-only credential, primary customer-facing copy

**Prior Purchase Evidence**:
Evidence that a purchase happened, such as Payhip order ID, purchase email, receipt, or another restore identifier.
_Avoid_: Entitlement itself, login session

**Support Request**:
Email-based manual support workflow for account deletion, restore help, or data/privacy requests.
_Avoid_: Instant automated action guarantee

**Support Inbox**:
The manual support intake channel for requests such as account deletion, restore help, or privacy/data questions.
_Avoid_: Realtime chat, instant response guarantee

**Privacy Request**:
A sensitive support request about personal data, such as account deletion, synced data deletion, data access, or data export.
_Avoid_: General support issue, ordinary product question

**Field Visibility**:
A UI preference for showing or hiding entry/card fields without deleting the underlying data.
_Aliases_: CSV Field visibility
_Avoid_: Data deletion, source edit

**CSV Field**:
A source/display field from the CSV schema, such as `T`, `D`, `P`, or `E` from the full `NO, T, D, P, E` schema.
_Avoid_: Card, Entry, deleted field

**T Field**:
The Term field: the headword or main item being learned.
_Avoid_: Translation, explanation

**D Field**:
The Definition field: the meaning or definition shown for the term.
_Avoid_: Pronunciation, explanation

**P Field**:
The Pronunciation field: reading or pronunciation information for the term.
_Avoid_: Definition, explanation

**E Field**:
The Explanation field: richer markdown explanation/details for the term.
_Avoid_: Term, definition, pronunciation

**Learn Card Display Columns**:
The field visibility preference for Learn/Memorize cards.
_Avoid_: Quiz Card Display Columns, source schema edit

**Quiz Card Display Columns**:
The field visibility preference for Quiz cards.
_Avoid_: Learn Card Display Columns, source schema edit

**Review**:
An activity that brings the learner back to previously seen items for reinforcement, often guided by progress or SRS state. Review can use Memorize, Quiz, or card UI mechanics, but it is not locked to one mode.
_Avoid_: Quiz only, Memorize only

**SRS**:
The spaced-repetition scheduling concept that decides when learned items should return for review.
_Avoid_: Study mode, score, progress UI

**FSRS**:
The scheduling algorithm/library used by the app for spaced-repetition review behavior.
_Avoid_: UI mode, quiz engine

**Rating**:
The learner's feedback after reviewing a card, mapped to the Thai options `ลืม`, `ยาก`, `เข้าใจ`, and `ง่าย`.
_Avoid_: Score, grade, quiz result

**Score**:
A quiz/session result summary based on correctness or positive ratings, shown after a quiz-like flow completes.
_Avoid_: SRS rating, progress, ownership

**Total**:
The number of cards included in a completed quiz/session result.
_Avoid_: Deck size, owned count

**Result Breakdown**:
The result summary grouped by rating or outcome labels after a quiz/session.
_Avoid_: Term Breakdown, raw progress state, source data

**Term Breakdown**:
The learner-facing decomposition of a term, matching the idea of `単語の分解`: breaking a word or item into meaningful parts for understanding.
_Avoid_: Quiz result summary, score breakdown

**Review Count**:
The number of cards from a completed quiz/session that should be reviewed again.
_Avoid_: Score, total cards

**Session**:
A single run of learning, quiz, or review activity, created from one deck or multiple decks. A session can have progress, total cards, ratings, score, or results, but it is not a permanent deck.
_Avoid_: Deck, bundle, ownership state

**Shuffle**:
Ordering behavior that changes the sequence of cards or entries inside a study/session flow without changing the official source order or deck definition.
_Avoid_: Permanent deck reorder, source mutation

**Session Shuffle**:
Shuffle applied to cards within one session.
_Avoid_: Deck definition change

**Deck Shuffle**:
Shuffle applied when starting or viewing study order for a deck.
_Avoid_: Editing the deck's canonical order

**Seeded Shuffle**:
A reproducible shuffle order that can be resumed, restored, or debugged.
_Avoid_: Fresh random order when resume/debug consistency matters

**Random Shuffle**:
A non-reproducible shuffle order generated fresh.
_Avoid_: Resume-safe order

**Continue**:
A resume point for a user's latest progress in a specific mode, deck, or session.
_Avoid_: Ownership state, deck state, entitlement state

**Progress**:
Learner state for a deck, mode, or session, such as the latest index, completed count, or review state.
_Avoid_: Availability, ownership, purchase status

**Overall Progress**:
A possible aggregate view of learner progress across decks, modes, or levels.
_Avoid_: MVP requirement, purchase state

**Pack**:
An overloaded word that can mean a sales product on landing or a CSV chunk in the content pipeline. In the app, prefer Deck for browse/study units and reserve Pack language for purchase, download, import, or source-label contexts.
_Avoid_: Deck, entry, unqualified pack

## Ownership

**Owned**:
Content the user can use in the app. Owned content can come from free embedded starter content or from a paid entitlement.
_Avoid_: Purchased, paid

**Free**:
Content available without purchase, such as embedded starter content or samples.
_Avoid_: Owned, entitled, Starter

**Entitled**:
Content unlocked by a purchase-backed Content Entitlement.
_Avoid_: Free, downloaded

**N5 Starter**:
The free starter offer/content available for beginning N5 study. It makes starter content owned/usable in the app, but it does not mean all N5 content is free.
_Aliases_: free N5, free tier N5
_Avoid_: all-free N5, N5 is free, customer-facing free N5 claim

**Starter**:
A content framing for beginner/on-ramp material.
_Avoid_: Free, full level

**Entitlement**:
Alias for Content Entitlement in everyday app conversation.
_Avoid_: App Entitlement, purchase, order, payment, download, copyright ownership

**Content Entitlement**:
An app-side usage right that lets a user access and keep purchased or granted Nihon Bunkai content inside the product experience. It is not a transfer of copyright, not an order record, not a payment, and not proof that files have already been downloaded or imported.
_Aliases_: Entitlement
_Avoid_: App Entitlement, purchase, order, payment, download, copyright ownership

**App Entitlement**:
A higher-level app benefit or app-access right, distinct from a content unlock. Use this full term for higher-tier or privilege-style app benefits so it does not get confused with Content Entitlement.
_Avoid_: Entitlement as shorthand, content unlock

**Locked**:
Content that exists in the catalog or UI but is not fully usable because the user does not own it yet. Locked content may still appear as catalog, preview, or sample content.
_Avoid_: Missing, unavailable, deleted

**Purchase**:
The checkout action that happens through Payhip and can result in an entitlement after the payment loop completes.
_Avoid_: Entitlement, download, import

**Download**:
The app action that retrieves entitled CSV content from storage after a purchase-backed Content Entitlement exists. In-app download means CSV download; PDFs are still downloaded through Payhip.
_Avoid_: Purchase, import, PDF download

**External CSV Download**:
CSV content downloaded outside the app through Payhip, then brought into the app by import.
_Avoid_: App download, PDF download

**App CSV Download**:
CSV content downloaded directly inside the app after purchase and entitlement are complete.
_Avoid_: Payhip PDF download, import

**PDF Download**:
PDF content downloaded through Payhip, not through the app import/download flow.
_Avoid_: App CSV download, import

**Import**:
The app action that parses CSV content and adds it to the Local Library so it becomes usable as decks.
_Avoid_: Download, entitlement

**Official Import**:
Importing official Nihon Bunkai CSV content into the Library, whether it came from app download or Payhip CSV download.
_Avoid_: User Content, Custom Deck

**Manual Import**:
An import flow where the user brings CSV files downloaded outside the app, usually from Payhip, into the app themselves.
_Avoid_: App CSV download, purchase

**User Import**:
Importing non-official or user-provided content into the Library.
_Avoid_: Official Import, Content Entitlement

**External Import**:
Alias for Manual Import. Use only when contrasting with direct app download or automatic import behavior.
_Avoid_: Separate feature from Manual Import

**Batch Import**:
Importing multiple CSV files or decks from a pack or bundle in one flow.
_Avoid_: Single-deck import, purchase

**Export**:
The app action that writes app data out to a user-controlled file or format.
_Avoid_: Re-selling official content, uncontrolled official content dump

**User Export**:
Exporting user-owned app data such as custom decks, user-created content, or user-manageable data.
_Avoid_: Official paid content export

**Official Content Export**:
Exporting official Nihon Bunkai content out of the app. This is copyright-sensitive and must not be treated as the default export path.
_Avoid_: Default export behavior, user data export

**Progress Export**:
Exporting learner progress, review state, or study metadata.
_Avoid_: Official content export

**Batch Export**:
Exporting multiple decks or data sets in one flow for power users.
_Avoid_: One-by-one export requirement, unrestricted official content dump

**Auto Import**:
A possible direct-app flow where app-downloaded CSV content becomes available as browse/study decks without the user manually selecting files. Treat this as a behavior to verify in code before relying on the term.
_Avoid_: Manual Import, confirmed shipped behavior without code check

## Relationships

- **Content Type -> JLPT Level -> Deck -> Entry** is the app-side learning hierarchy.
- **Deck** has many **Entries**.
- **Entry** belongs to one **Deck** in the app-facing study/browse experience.
- **Term** usually maps to one **Entry**, while **Card** is how that entry/term appears in the UI.
- **Pack** can unlock or deliver content that appears as one or more **Decks**, but it is not itself a **Deck** in app domain language.
- **Browse** shows **Ready** content as terms and decks for use.
- **Search Pill** is a navigation affordance into **Search**. It can look like an input, but it should not perform inline Browse filtering.
- **Term Search** queries the **Search Scope**, which should primarily contain ready-to-learn content.
- **Search Corpus** is an implementation-facing alias for **Search Scope**.
- **Search** can expand beyond **Term Search** in future features.
- **Catalog** is official-only; **Library** can contain official content and **User Content**.
- **Custom Deck** is one form of **User Content**.
- **Local Library** should be treated as more durable than temporary **Cache**, especially for user-imported content and personal edits.
- **Offline-first** uses **Local Library** for study after content is available locally.
- **Re-download** can recover official CSV content when **Content Entitlement** exists, but it does not recover local-only user edits or custom content.
- **Cache Reset** needs **Backup Warning** copy if it can remove local-only user data.
- **Official Source** stays immutable; **Personal Edit** should be stored as **User Override** against a **Library Copy**.
- **User Override** is local-only by default and should not be synced to Supabase as term source.
- **Manual Backup** or **Google Drive Backup** can preserve user-owned edits/data without making Supabase the user term store.
- **App State Sync** can include **User Progress Data Sync** and **Entitlement Sync**.
- **User Data Backup** is separate from **App State Sync** and should be manual by default.
- **Sync** alone is shorthand and should be clarified before implementation.
- **Language Toggle** should happen late to avoid duplicating copy, QA, UI layout, and logic work during active feature development.
- **Thai-first** is the default until the language toggle phase is explicitly reopened.
- **Login Polish** is a polish lane, not the default next task unless the user reopens it.
- When core app logic, backlog features, and major UX flows are mostly stable, deferred polish lanes should be revisited proactively.
- **Visual QA** should run after larger implementation rounds or before closing UI-impacting work.
- **UI Polish** and **UX Polish** should not displace functional backlog unless the visual or interaction issue blocks practical use.
- **Shop** presents **Catalog** items and can send the user to **Payhip Checkout**.
- **Payhip Checkout** completes payment and handles PDF downloads; it is not the main Nihon Bunkai storefront experience.
- **Payhip** handles checkout and PDF downloads; **Supabase** is the app-side source of truth for content entitlements.
- **Payhip Order** can lead to a **Purchase Record**, which can grant a **Content Entitlement**.
- **Content Entitlement** unlocks CSV app download/import behavior, not in-app PDF download.
- **SKU** can connect app catalog state to payment and entitlement systems, but should not be rendered as the main UI label for learners.
- **In Browse** is the user-facing destination message for **Ready** content.
- **Multi-deck Study** creates a temporary **Deck Group Session** from multiple selected **Decks**.
- **Learn** is not a separate mode from **Memorize**; it is the UI/copy layer for the memorization-oriented flow.
- **Memorize** and **Quiz** can use the same **Entries** and **Cards**, but they have different learner intent.
- **Multiple Choice** and **Dictation** are **Quiz Variants**, not top-level modes separate from **Quiz**.
- **Quiz Config** shapes a quiz/session before it starts and should not mutate deck definitions or global app settings.
- **Quiz Mode** may be used as casual wording for **Quiz Variant**, but **Quiz Variant** is the precise glossary term.
- **Settings** can grow to cover more app/account utilities, but session-specific study setup belongs in **Quiz Config** or the relevant study flow.
- **Account** identifies the app user; it is separate from **Payhip Order**, **Purchase Record**, and **Local Library**.
- **Profile** is user-facing metadata/preferences and should not be used as the entitlement or purchase source of truth.
- **Onboarding State** is local-only for MVP and should not be tied to entitlement or content ownership.
- **Onboarding Polish** should be revisited when major app flows are stable or if first-run UX blocks practical use.
- **Account Deletion** can remove account/profile/auth-related state, but prior purchases may still be restorable with **Prior Purchase Evidence** or a **Restore Identifier**.
- **Delete Account**, **Delete Local Data**, and **Delete Synced Data** are separate actions and need different warnings.
- **Restore Purchase** should be hybrid in MVP: **Automatic Restore** when matching succeeds, **Manual Restore** through support when it does not.
- **Restore Purchase** recovers or verifies rights; **Re-download** retrieves official CSV files again after those rights exist.
- **Restore Identifier** is an internal/support umbrella term; customer-facing copy should ask for concrete items like order ID, purchase email, or receipt.
- **Support Request** is manual and email-based unless a later automated workflow is explicitly built.
- **Support Inbox** should be explained in plain language when discussed with the user: it means the place/channel where support requests arrive.
- **Privacy Request** can go through the **Support Inbox** in MVP, but should be treated as more sensitive than ordinary support.
- **Field Visibility** controls which **CSV Fields** appear on cards; it does not remove data from the **Entry**.
- **T Field**, **D Field**, **P Field**, and **E Field** are display/source fields from the CSV-backed entry shape.
- **Learn Card Display Columns** and **Quiz Card Display Columns** can differ because Learn/Memorize and Quiz have different display needs.
- **Review** can be implemented through **Memorize**, **Quiz**, or other card-based mechanics.
- **SRS** guides when items return for **Review**.
- **FSRS** is the algorithmic implementation of **SRS** behavior in the app.
- **Rating** feeds SRS/FSRS scheduling after a reviewed **Card**.
- **Score**, **Total**, **Result Breakdown**, and **Review Count** describe quiz/session results, not ownership or content availability.
- **Term Breakdown** belongs to learning content explanation, not quiz result reporting.
- **Session** can be created from one **Deck** or from a **Deck Group Session**.
- **Shuffle** affects session/study ordering, not official source order.
- **Seeded Shuffle** should be preferred when resume, restore, or debugging requires a stable order.
- **Continue** resumes mode-specific progress, such as Learn/Memorize progress or Quiz progress, without changing ownership or deck identity.
- **Progress** belongs to learner activity, not content availability.
- **Overall Progress** is a future aggregate concept, not a current MVP assumption.
- **Owned** includes both **Free** and **Entitled** content.
- **N5 Starter** is **Free** owned starter content, not the whole N5 catalog.
- **Free** is a price/access state; **Starter** is content framing.
- **Entitled** implies a purchase-backed **Content Entitlement**, but does not by itself mean the content has already been downloaded or imported.
- **Entitlement** without a qualifier means **Content Entitlement** by default.
- **App Entitlement** must be named explicitly when discussing app-level benefits.
- **Content Entitlement** grants app/product usage rights, while Nihon Bunkai retains copyright over the content.
- **Locked** is the opposite of **Owned** for full-use app behavior, but locked content can still be visible as catalog or preview content.
- **Purchase -> Entitlement -> Download -> Import -> Decks** is the intended CSV-in-app flow.
- **Download** and **Import** are separate states; a user can be entitled without having imported the content yet.
- CSV content has two valid access paths: **App CSV Download -> Import** or **External CSV Download -> Import**.
- PDF content always uses **PDF Download** through Payhip and does not become app decks through import.
- A bundle can grant both CSV and PDF benefits, but only the CSV side participates in the app download/import flow.
- **Official Import** adds official content to the **Library** but does not make it **User Content**.
- **User Import** creates **User Content** or **Custom Decks**.
- **Manual Import** and **External Import** mean the same user-provided-file path; prefer **Manual Import** as the canonical term.
- **Export** should focus on **User Export**, **Progress Export**, and safe **Batch Export** flows.
- **Official Content Export** is not a default user right and must be treated as a copyright-sensitive action.
- **Auto Import** may describe the current in-app download behavior, but this must be verified against the app code before implementation work depends on it.

## Example Dialogue

Dev: "Is this CSV file the deck?"

Domain expert: "Not exactly. The CSV pack can become a deck in the app, but deck means the user-facing study unit grouped under a content type and JLPT level."

Dev: "So a Vocab N5 level can have several decks?"

Domain expert: "Yes. Each deck is a smaller set of entries so the app does not treat the whole level as one huge study unit."

Dev: "Should the app call a study unit a pack?"

Domain expert: "No. Use pack only when talking about purchased/downloaded content. The thing a learner studies is a deck."

Dev: "The Browse screen currently shows rows like `Kanji N5 - Pack 01`. Is that a sales pack?"

Domain expert: "No. In Browse, that should be treated as a deck display name. Prefer renaming those labels to `Deck 01` so app study units do not conflict with sales packs."

Dev: "Should the UI say Group Study?"

Domain expert: "Prefer Multi-deck Study for UI copy. Deck Group Session is the internal concept: several selected decks studied together temporarily."

Dev: "Does Term Search scan every source file?"

Domain expert: "No. Term Search is for ready-to-learn app entries and must stay performant for the full 10k-plus term corpus."

Dev: "Should user-imported decks become part of the Catalog?"

Domain expert: "No. Catalog is official Nihon Bunkai content. User-imported decks live in the Library as User Content or Custom Decks."

Dev: "Can users edit official content?"

Domain expert: "They can make Personal Edits through User Overrides on their Library Copy. The Official Source remains immutable."

Dev: "Should Supabase sync edited terms?"

Domain expert: "No. Supabase should sync entitlement/progress-style state. User-edited terms stay local unless the user manually backs them up."

Dev: "When the user says sync, what should I assume?"

Domain expert: "Do not assume. It may mean App State Sync or User Data Backup. Clarify from context."

Dev: "Can progress sync through Supabase?"

Domain expert: "Yes. User Progress Data Sync belongs to App State Sync. User-edited terms and custom decks belong to User Data Backup."

Dev: "Should every new feature ship with Thai and English copy now?"

Domain expert: "No. The app is Thai-first for now. Language Toggle is late-phase to avoid duplicated work while features are still changing."

Dev: "Should we polish login before functional backlog?"

Domain expert: "Only if explicitly reopened. Login Polish is deferred polish, not the default priority."

Dev: "Should deferred polish stay deferred forever?"

Domain expert: "No. Once core logic and major flows are stable, suggest revisiting Language Toggle, Login Polish, and deeper UI/UX cleanup."

Dev: "Is Visual QA the same as redesign?"

Domain expert: "No. Visual QA catches concrete defects. UI Polish and UX Polish improve feel and workflow after the functional surface is stable."

Dev: "Is Payhip the Shop?"

Domain expert: "No. The app has a Shop surface and the landing is the main storefront. Payhip is the checkout/product host behind purchases and PDF downloads."

Dev: "Does Payhip decide what is unlocked in the app?"

Domain expert: "No. Payhip produces the order event. Supabase is the app-side source of truth for content entitlements."

Dev: "Should the app show SKU IDs to users?"

Domain expert: "No. The app can know SKUs internally, but user-facing UI should show product names, levels, formats, and ownership actions."

Dev: "Is the card the data object?"

Domain expert: "No. Entry is the data unit, term is the learner-facing item, and card is the UI representation."

Dev: "Is Learn a third study mode?"

Domain expert: "No. Learn is UI/copy language for Memorize. Quiz is the separate test-like mode."

Dev: "Is Multiple Choice a new top-level mode?"

Domain expert: "No. Multiple Choice is a Quiz Variant. Quiz is the top-level mode."

Dev: "Can the user say Quiz Mode?"

Domain expert: "Yes, as casual wording. In docs and architecture, Quiz Variant is the precise term."

Dev: "Does Quiz Config edit the deck?"

Domain expert: "No. Quiz Config prepares a session. It does not change the deck definition."

Dev: "Should Settings contain every study option?"

Domain expert: "No. Settings is for app/account preferences and utilities. Per-session study options belong in Quiz Config or the study flow."

Dev: "Is Account the same as a Payhip customer?"

Domain expert: "No. Account is the app identity/auth profile. Payhip customer/order data is purchase evidence."

Dev: "Does Profile decide what the user owns?"

Domain expert: "No. Profile is metadata/preferences. Content Entitlement decides app-side content unlocks."

Dev: "Should onboarding sync across devices now?"

Domain expert: "No. Onboarding State can stay local-only for MVP."

Dev: "Can onboarding UX be polished later?"

Domain expert: "Yes. Onboarding Polish is a good deferred UX lane once core flows are stable."

Dev: "If the user deletes the account, are purchases gone forever?"

Domain expert: "Not necessarily. Purchases may be restorable with prior purchase evidence or a restore identifier."

Dev: "Is Delete Account the same as deleting local data?"

Domain expert: "No. Delete Account affects backend account/profile/auth-related data. Delete Local Data affects data on this device."

Dev: "Should restore always be instant?"

Domain expert: "No. MVP restore is hybrid: automatic when matching works, manual support when it does not."

Dev: "Is re-download the same as restore purchase?"

Domain expert: "No. Restore Purchase recovers the right. Re-download uses an existing right to download official CSV files again."

Dev: "Should the UI ask for a Restore Identifier?"

Domain expert: "No. Ask for concrete customer language like order ID, purchase email, or receipt. Restore Identifier is an internal/support term."

Dev: "Is support request automated?"

Domain expert: "No. Treat it as email-based manual support unless automation is explicitly implemented."

Dev: "Is Support Inbox live chat?"

Domain expert: "No. Support Inbox means the support intake channel for manual requests, not realtime chat."

Dev: "Is deleting account just a normal support question?"

Domain expert: "No. It is a Privacy Request and should be handled with more care than ordinary support."

Dev: "If the user hides E, is the E data deleted?"

Domain expert: "No. Field Visibility only changes card display. The Entry still has its CSV fields."

Dev: "What does E mean?"

Domain expert: "E is Explanation: the richer markdown explanation/details field."

Dev: "Is Review the same as Quiz?"

Domain expert: "No. Review is the learner activity of returning to previous items. Quiz can be one way to review."

Dev: "Is FSRS a study mode?"

Domain expert: "No. FSRS is the scheduling algorithm behind spaced repetition, not a user-facing mode."

Dev: "Are the four review buttons a score?"

Domain expert: "No. They are ratings that feed review scheduling: ลืม, ยาก, เข้าใจ, ง่าย."

Dev: "Is the 65% result an SRS rating?"

Domain expert: "No. That is a score for the completed quiz/session. Ratings are the per-card feedback underneath."

Dev: "Can we call the quiz result bars Breakdown?"

Domain expert: "Use Result Breakdown for quiz result bars. Term Breakdown is reserved for decomposing a word or term, like 単語の分解."

Dev: "Is a session a deck?"

Domain expert: "No. A session is one run of study or quiz activity created from one or more decks."

Dev: "Does Shuffle rewrite the deck?"

Domain expert: "No. Shuffle changes the order inside a study/session flow. It does not mutate official source order or deck definition."

Dev: "Does Continue mean the deck is owned or imported?"

Domain expert: "No. Continue only means there is progress to resume in a mode or session."

Dev: "Should we build an overall progress dashboard now?"

Domain expert: "Not from this term alone. Overall Progress is a future aggregate concept and should wait until stats/progress work is explicitly reopened."

Dev: "If N5 Starter is free, is it owned?"

Domain expert: "Yes. Owned means usable in the app. Free and entitled are different sources of ownership."

Dev: "If a deck is locked, should it disappear?"

Domain expert: "No. Locked can still be visible in the catalog or preview state. It just should not be fully usable until it becomes owned."

Dev: "If a user has an entitlement, do they own the copyright?"

Domain expert: "No. They have usage rights inside the Nihon Bunkai product experience. They cannot resell or redistribute the content as their own."

Dev: "Does entitlement mean Full Bundle app benefits?"

Domain expert: "Not by default. Entitlement means Content Entitlement unless we explicitly say App Entitlement."

Dev: "After buying a bundle, does the app download everything?"

Domain expert: "No. The app download is for CSV content. PDFs remain Payhip downloads."

Dev: "Is downloaded content ready to study?"

Domain expert: "Only after import. Download retrieves the CSV files; import turns them into usable app decks."

Dev: "Can the user import CSVs they downloaded from Payhip?"

Domain expert: "Yes. CSVs can enter the app either by direct app download after entitlement or by external Payhip download followed by import."

Dev: "If official CSV is imported manually, is it User Content?"

Domain expert: "No. It is still official Nihon Bunkai content imported into the Library. User Content is non-official or user-provided content."

Dev: "Should manual import and external import be separate features?"

Domain expert: "No. Manual import is the canonical term. External import is just an alias when we need to contrast it with app download."

Dev: "Can export dump all official paid content?"

Domain expert: "No. Export should focus on user data, progress, custom decks, or safe batch flows. Official content export is copyright-sensitive."

Dev: "Should power users export one deck at a time?"

Domain expert: "No. Batch Export is the expected power-user flow when export is implemented."

Dev: "If a user downloads in the app and the deck appears in Browse, is that auto import?"

Domain expert: "Probably, or an equivalent direct app-download-to-library flow. Verify the existing code before naming or extending it."

## Flagged Ambiguities

**Pack label in Browse**:
The current Browse UI may display deck-like study units with names such as `Pack 01`, likely inherited from CSV output naming. In app domain language, the study unit is still **Deck**; if UI copy is revised, prefer `Deck 01` unless preserving source labels is intentional.

<!-- cspell:enable -->
