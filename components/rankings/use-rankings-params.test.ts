import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SERVER_RANKINGS_PARAMS } from "@/components/rankings/use-rankings-params";

describe("SERVER_RANKINGS_PARAMS", () => {
  it("refetches when sort or page size changes so ranking is table-wide", () => {
    assert.equal(SERVER_RANKINGS_PARAMS.has("sort"), true);
    assert.equal(SERVER_RANKINGS_PARAMS.has("sortDir"), true);
    assert.equal(SERVER_RANKINGS_PARAMS.has("pageSize"), true);
  });
});
