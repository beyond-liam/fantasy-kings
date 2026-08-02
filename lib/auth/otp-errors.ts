/** Map Supabase OTP auth errors to clearer copy for the login/register tabs. */
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

  if (
    mode === "register" &&
    (normalized.includes("already registered") ||
      normalized.includes("user already exists") ||
      normalized.includes("email address is already"))
  ) {
    return "An account already exists for that email. Switch to Log In instead.";
  }

  return message;
}
