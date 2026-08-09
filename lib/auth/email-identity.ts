/** True when the user can sign in with email (password or legacy OTP identity). */
export function userHasEmailIdentity(user: {
  identities?: { provider: string }[] | null;
}): boolean {
  return (user.identities ?? []).some(
    (identity) => identity.provider === "email",
  );
}
