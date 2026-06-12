<!-- cspell:disable -->

# Email Confirmation + Resend SMTP

## Goal

Make sign-up feel more trustworthy by requiring email confirmation before password login, while avoiding Supabase's default production email limitations.

## Decision

- Keep Supabase Auth as the account/session source of truth.
- Use a custom SMTP provider for Supabase Auth emails.
- Recommended provider for launch: Resend.
- Do not build a custom verification-token system for MVP.
- Do not commit SMTP credentials, API keys, or SMTP passwords to the repository.

## App Behavior

- Password sign-up sends a confirmation email and redirects confirmed users back to `/login`.
- If Supabase returns a pending user without a session, the Login screen shows a Thai confirmation state.
- The confirmation state includes a resend action for the same email.
- Password sign-in maps Supabase's unconfirmed-email error to Thai learner-facing copy.
- Magic link remains available and keeps its existing login redirect behavior.

## Production Setup Checklist

1. Verify `nihon-bunkai.com` in Resend.
2. Configure DNS records requested by Resend, including DKIM/SPF and any required bounce/return-path records.
3. Create a sender such as `no-reply@nihon-bunkai.com`.
4. In Supabase dashboard, open Auth email/SMTP settings and enable custom SMTP.
5. Enter Resend SMTP host, port, username, and password from Resend. Store credentials only in Supabase dashboard/secret storage.
6. Set Supabase Auth Site URL to `https://app.nihon-bunkai.com`.
7. Add redirect URLs for:
   - `https://app.nihon-bunkai.com/login`
   - local development login URL when testing locally
8. Turn on Confirm email for the hosted Supabase project.
9. Send a test sign-up email and verify:
   - email arrives from the Nihon Bunkai sender,
   - confirmation link opens the app login route,
   - password login works after confirmation,
   - unconfirmed password login shows Thai guidance,
   - resend confirmation sends another email.

## Watch-Outs

- Do not enable hosted confirmation before custom SMTP and redirect URLs are verified.
- If email delivery fails, users cannot finish sign-up. Treat this as a launch blocker.
- Supabase local config is a source snapshot for local development, not proof that hosted dashboard settings are live.
- Keep email copy restrained and clear; do not over-explain Supabase or Resend to learners.

<!-- cspell:enable -->
