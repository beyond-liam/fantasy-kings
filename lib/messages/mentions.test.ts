import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractMentionUsernames,
  getActiveMention,
  insertMentionToken,
  splitMessageBody,
} from "@/lib/messages/mentions";

describe("message mentions", () => {
  it("detects an active @ query at the caret", () => {
    assert.deepEqual(getActiveMention("hey @li", 7), {
      start: 4,
      query: "li",
    });
    assert.equal(getActiveMention("hey @li there", 13), null);
  });

  it("extracts unique usernames", () => {
    assert.deepEqual(extractMentionUsernames("hi @Ann and @bob and @Ann"), [
      "ann",
      "bob",
    ]);
  });

  it("inserts a mention token with a trailing space", () => {
    assert.deepEqual(insertMentionToken("hi @li", 6, 3, "liam"), {
      value: "hi @liam ",
      caret: 9,
    });
  });

  it("splits body into boldable mention segments", () => {
    const segments = splitMessageBody("hi @liam!");
    assert.deepEqual(segments, [
      { type: "text", value: "hi " },
      { type: "mention", value: "@liam", username: "liam" },
      { type: "text", value: "!" },
    ]);
  });
});
