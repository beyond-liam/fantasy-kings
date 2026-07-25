export const MENTION_TOKEN_RE = /@([a-zA-Z0-9_]+)/g;

/** Active @query at caret, if any. */
export function getActiveMention(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const match = before.match(/(^|[\s([{])@([a-zA-Z0-9_]*)$/);
  if (!match) return null;
  const atIndex = before.lastIndexOf("@");
  if (atIndex < 0) return null;
  return { start: atIndex, query: match[2] ?? "" };
}

export function extractMentionUsernames(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(MENTION_TOKEN_RE)) {
    const username = match[1];
    if (username) found.add(username.toLowerCase());
  }
  return [...found];
}

export function insertMentionToken(
  value: string,
  caret: number,
  mentionStart: number,
  username: string,
): { value: string; caret: number } {
  const token = `@${username}`;
  const after = value.slice(caret);
  const needsSpace = after.length === 0 || !/^\s/.test(after);
  const inserted = needsSpace ? `${token} ` : token;
  const next = `${value.slice(0, mentionStart)}${inserted}${after}`;
  return {
    value: next,
    caret: mentionStart + inserted.length,
  };
}

export type MessageBodySegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; username: string };

export type MentionCandidate = {
  userId: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
};

export function splitMessageBody(body: string): MessageBodySegment[] {
  const segments: MessageBodySegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_TOKEN_RE.source, "g");

  for (const match of body.matchAll(re)) {
    const username = match[1] ?? "";
    const start = match.index ?? 0;
    const full = match[0] ?? "";
    if (start > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, start) });
    }
    if (username) {
      segments.push({ type: "mention", value: full, username });
    } else {
      segments.push({ type: "text", value: full });
    }
    lastIndex = start + full.length;
  }

  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: body }];
}
