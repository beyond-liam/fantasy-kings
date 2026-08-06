import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDraftStartsAt, resolveDraftListStatus } from "./draft-status";

describe("formatDraftStartsAt", () => {
  it("formats on-the-hour times without minutes", () => {
    const date = new Date(2026, 7, 31, 9, 0, 0, 0);
    assert.equal(
      formatDraftStartsAt(date),
      "Starts at 9am on the 31st August, 2026",
    );
  });

  it("formats afternoon times and ordinal days", () => {
    const date = new Date(2026, 9, 23, 20, 30, 0, 0);
    assert.equal(
      formatDraftStartsAt(date),
      "Starts at 8:30pm on the 23rd October, 2026",
    );
  });
});

describe("resolveDraftListStatus", () => {
  it("labels completed drafts as Drafted", () => {
    assert.deepEqual(
      resolveDraftListStatus({ status: "complete", draftStartAt: null }),
      { kind: "complete", label: "Drafted" },
    );
  });

  it("labels live and email drafts in progress", () => {
    assert.deepEqual(
      resolveDraftListStatus({
        status: "live",
        draftStartAt: null,
        draftType: "email",
      }),
      { kind: "in_progress", label: "Email draft in progress" },
    );
    assert.deepEqual(
      resolveDraftListStatus({
        status: "paused",
        draftStartAt: null,
        draftType: "live",
      }),
      { kind: "in_progress", label: "Live draft in progress" },
    );
  });

  it("labels scheduled drafts with type and date", () => {
    const draftStartAt = new Date("2026-08-07T15:00:00.000Z");
    const result = resolveDraftListStatus({
      status: "scheduled",
      draftStartAt,
      draftType: "email",
    });
    assert.equal(result.kind, "scheduled");
    assert.match(result.label, /^Email draft scheduled /);
  });
});
