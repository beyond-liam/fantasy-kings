import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapAuthError } from "@/lib/auth/auth-errors";

describe("mapAuthError", () => {
  it("maps invalid credentials on login", () => {
    assert.equal(
      mapAuthError("Invalid login credentials", "login"),
      "Incorrect email or password.",
    );
  });

  it("maps unconfirmed email on login", () => {
    assert.equal(
      mapAuthError("Email not confirmed", "login"),
      "Confirm your email before logging in. Check your inbox for a verification link.",
    );
  });

  it("leaves unrelated login errors unchanged", () => {
    assert.equal(
      mapAuthError("Email rate limit exceeded", "login"),
      "Email rate limit exceeded",
    );
  });

  it("points existing users to log in from register", () => {
    assert.equal(
      mapAuthError("User already registered", "register"),
      "An account already exists for that email. Switch to Log In instead.",
    );
  });

  it("explains short passwords", () => {
    assert.equal(
      mapAuthError("Password should be at least 6 characters", "register"),
      "Password must be at least 8 characters.",
    );
  });
});
