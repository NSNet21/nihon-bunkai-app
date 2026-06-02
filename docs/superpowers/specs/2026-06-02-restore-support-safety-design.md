# Restore Support Safety Design

## Goal

Make Settings safer for paying users before marketing: restore/unlock language must be clearer, support requests must be easy to send, and local-only Library data must not be accidentally lost during browser cache reset or device changes.

## Scope

- Keep this pass inside Settings plus small pure helper logic.
- Do not rewrite Payhip, Supabase, or `claim_purchases_by_order`.
- Do not touch Browse/Search performance-sensitive paths.
- Keep the app Thai-first.

## User Flow

1. User opens Settings.
2. Account card clearly offers a purchase-rights check/restore refresh.
3. Restore form remains available for signed-in users who bought with a different email.
4. A Local Data Safety card explains:
   - official paid app content can be restored through account entitlements and re-downloaded,
   - Payhip receipts/account remain the PDF download path,
   - manual imported/custom content is local-first and should be exported before cache reset, browser change, or device move.
5. A Support card opens an email template addressed to `hi@nihon-bunkai.com` with useful fields prefilled.

## Support Helper

Add a focused helper that builds support mailto URLs and keeps support copy testable without rendering the Settings screen.

The helper should include:

- support email constant,
- support issue type labels,
- mailto builder with encoded subject/body,
- safety copy arrays for Settings.

## Import / Export Help Follow-Up

Do not expand Import / Export help in this implementation pass.

Future polish direction:

- Turn Import help into a click-through modal help surface.
- Avoid a new route unless the help surface grows large enough to justify routing.
- Teach Import more than Export, because Export is mostly self-explanatory.
- Include a realistic CSV sample using `NO,T,D,P,E`.
- Consider screenshots after the main regression/perf pass.
- Keep this as a help/education design task, not part of Restore / Support Safety implementation.

## Testing

- Add Vitest coverage for support mailto generation and safety-copy boundaries.
- Run targeted support-safety tests.
- Run TypeScript check or Expo lint if feasible.
- If starting the dev server later, smoke Settings route lightly for visible sections and no console errors.
