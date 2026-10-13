type SignupResponse = {
  data: { session: unknown | null; user: { identities?: unknown[] } | null };
  error: { code?: string; message: string } | null;
};
export const EXISTING_ACCOUNT_MESSAGE = "An account already exists with this email. Sign in to your existing account instead.";
/** Interpret only the signup response; never query a public email-existence endpoint. */
export function signupOutcome({ data, error }: SignupResponse):
  | { kind: "error"; message: string }
  | { kind: "existing"; message: string }
  | { kind: "signed-in" }
  | { kind: "confirmation" } {
  if (error) {
    const duplicate = ["user_already_exists", "email_exists", "user_already_registered"].includes(error.code ?? "") ||
      /user already registered|account already exists/i.test(error.message);
    return { kind: duplicate ? "existing" : "error", message: duplicate ? EXISTING_ACCOUNT_MESSAGE : error.message };
  }
  if (data.session) return { kind: "signed-in" };
  // Supabase may mask an existing confirmed account with an empty identity list.
  // An absent list is not the same signal and must not be declared a duplicate.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { kind: "existing", message: EXISTING_ACCOUNT_MESSAGE };
  }
  if (!data.user) return { kind: "error", message: "Signup could not be confirmed. Please try again or sign in if you already have an account." };
  return { kind: "confirmation" };
}
