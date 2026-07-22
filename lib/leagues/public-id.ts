/** URL-safe alphabet (no 0/O/1/I). 32^6 ≈ 1B combinations. */
const PUBLIC_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PUBLIC_ID_LENGTH = 6;

export function generatePublicId(length = PUBLIC_ID_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += PUBLIC_ID_ALPHABET[bytes[i]! % PUBLIC_ID_ALPHABET.length];
  }
  return id;
}

export function isPublicIdFormat(value: string): boolean {
  if (value.length !== PUBLIC_ID_LENGTH) {
    return false;
  }
  for (const char of value) {
    if (!PUBLIC_ID_ALPHABET.includes(char)) {
      return false;
    }
  }
  return true;
}
