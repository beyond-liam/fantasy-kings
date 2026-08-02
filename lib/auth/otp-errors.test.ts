import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapOtpSendError } from "@/lib/auth/otp-errors";

describe("mapOtpSendError", () => {
  it("explains missing accounts on the login tab", () => {
    assert.equal(
      mapOtpSendError("Signups not allowed for otp", "login"),
      "No account found for that email. Switch to Register to create one.",
    );
  });

  it("leaves unrelated login errors unchanged", () => {
    assert.equal(
      mapOtpSendError("Email rate limit exceeded", "login"),
      "Email rate limit exceeded",
    );
  });

  it("points existing users to log in from register", () => {
    assert.equal(
      mapOtpSendError("User already registered", "register"),
      "An account already exists for that email. Switch to Log In instead.",
    );
  });
});
