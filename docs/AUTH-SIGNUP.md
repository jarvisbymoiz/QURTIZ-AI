# Signup response handling

Qurtiz keeps Supabase Auth as the authority for registration and account uniqueness. The signup page uses `src/lib/supabase/signup-result.ts` to interpret responses:

- An explicit duplicate-email/account error shows an existing-account message and a sign-in link.
- A successful-looking response with no session and an explicitly empty user identity array is treated as Supabase's masked existing-account response, rather than incorrectly claiming a confirmation email was sent.
- A new user without a session receives email-confirmation guidance.
- A real session keeps the existing dashboard redirect.
- Missing identities alone are not proof of a duplicate. An empty response is an error; provider and rate-limit errors are preserved.

The error remains visible inline with an accessible alert and clears when the input changes. Emails are trimmed before submission. No admin-key lookup, public email-existence endpoint, authentication configuration change or database migration is involved. Passwords and signup response credentials are not logged.

Verification: nine offline response-handling tests and TypeScript passed. Live account creation was not attempted, so no test confirmation emails were sent. Deployment is a separate step.

Test command: `npx vitest run src/lib/supabase/__tests__/signup-result.test.ts --maxWorkers=1`.
