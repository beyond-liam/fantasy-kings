/** Map Supabase auth errors to clearer copy for register/login. */
export function mapAuthError(
  message: string,
  mode: "register" | "login",
): string {
  const normalized = message.trim().toLowerCase();

  if (
    mode === "login" &&
    (normalized.includes("invalid login credentials") ||
      normalized.includes("invalid credentials") ||
      normalized.includes("user not found"))
  ) {
    return "Incorrect email or password.";
  }

  if (
    mode === "login" &&
    (normalized.includes("email not confirmed") ||
      normalized.includes("not confirmed"))
  ) {
    return "Confirm your email before logging in. Check your inbox for a verification link.";
  }

  if (
    mode === "register" &&
    (normalized.includes("already registered") ||
      normalized.includes("user already exists") ||
      normalized.includes("email address is already"))
  ) {
    return "An account already exists for that email. Switch to Log In instead.";
  }

  if (
    normalized.includes("password should be") ||
    normalized.includes("password is too short") ||
    normalized.includes("weak password")
  ) {
    return "Password must be at least 8 characters.";
  }

  return message;
}

/** @deprecated Prefer mapAuthError — kept for any remaining OTP call sites. */
export function mapOtpSendError(
  message: string,
  mode: "register" | "login",
): string {
  const normalized = message.trim().toLowerCase();

  if (
    mode === "login" &&
    (normalized.includes("signups not allowed") ||
      normalized.includes("otp_disabled") ||
      normalized.includes("user not found"))
  ) {
    return "No account found for that email. Switch to Register to create one.";
  }

  return mapAuthError(message, mode);
}
