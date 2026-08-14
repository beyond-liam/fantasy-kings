import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  dataTablePageSizeQueryValue,
  parseDataTablePageSize,
} from "@/components/ui/data-table/page-size";

describe("parseDataTablePageSize", () => {
  it("defaults to 25", () => {
    assert.equal(parseDataTablePageSize(), DEFAULT_DATA_TABLE_PAGE_SIZE);
    assert.equal(parseDataTablePageSize("7"), 25);
  });

  it("accepts 10, 25, and 50", () => {
    assert.equal(parseDataTablePageSize("10"), 10);
    assert.equal(parseDataTablePageSize("25"), 25);
    assert.equal(parseDataTablePageSize("50"), 50);
  });
});

describe("dataTablePageSizeQueryValue", () => {
  it("omits the default from the URL", () => {
    assert.equal(dataTablePageSizeQueryValue(25), null);
    assert.equal(dataTablePageSizeQueryValue(10), "10");
  });
});
