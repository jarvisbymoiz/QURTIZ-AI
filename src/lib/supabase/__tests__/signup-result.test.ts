import { describe, expect, it } from "vitest";
import { signupOutcome, EXISTING_ACCOUNT_MESSAGE } from "../signup-result";
describe("signup response handling", () => {
  it("recognizes a masked existing account without falsely promising an email", () => {
    expect(signupOutcome({ data: { session: null, user: { identities: [] } }, error: null })).toEqual({ kind: "existing", message: EXISTING_ACCOUNT_MESSAGE });
  });
  it.each(["user_already_exists", "email_exists", "user_already_registered"])("handles explicit duplicate error %s", code => {
    expect(signupOutcome({ data: { session: null, user: null }, error: { code, message: "Duplicate" } }).kind).toBe("existing");
  });
  it("preserves fresh email confirmation", () => expect(signupOutcome({ data: { session: null, user: { identities: [{}] } }, error: null }).kind).toBe("confirmation"));
  it("does not misclassify missing identities", () => expect(signupOutcome({ data: { session: null, user: {} }, error: null }).kind).toBe("confirmation"));
  it("preserves immediate authenticated signup", () => expect(signupOutcome({ data: { session: {}, user: { identities: [] } }, error: null }).kind).toBe("signed-in"));
  it("preserves real provider errors", () => expect(signupOutcome({ data: { session: null, user: null }, error: { code: "over_email_send_rate_limit", message: "Wait before retrying" } })).toEqual({ kind: "error", message: "Wait before retrying" }));
  it("does not display success for an empty response", () => expect(signupOutcome({ data: { session: null, user: null }, error: null }).kind).toBe("error"));
});
