import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  absoluteAppUrl,
  draftRoomUrl,
  getAppBaseUrl,
  tradesUrl,
} from "@/lib/email/app-url";

describe("getAppBaseUrl", () => {
  it("prefers APP_URL over NEXT_PUBLIC_APP_URL", () => {
    assert.equal(
      getAppBaseUrl({
        nodeEnv: "production",
        appUrl: "https://app.example.com/",
        nextPublicAppUrl: "http://localhost:3000",
      }),
      "https://app.example.com",
    );
  });

  it("skips localhost NEXT_PUBLIC_APP_URL in production and uses Vercel", () => {
    assert.equal(
      getAppBaseUrl({
        nodeEnv: "production",
        nextPublicAppUrl: "http://localhost:3000",
        vercelProjectProductionUrl: "fantasykings.app",
      }),
      "https://fantasykings.app",
    );
  });
});

describe("absoluteAppUrl", () => {
  it("joins relative paths to the app base", () => {
    const env = {
      nodeEnv: "production",
      appUrl: "https://app.example.com",
    };
    assert.equal(
      absoluteAppUrl("/league/abc/trades", env),
      "https://app.example.com/league/abc/trades",
    );
    assert.equal(
      tradesUrl("abc", env),
      "https://app.example.com/league/abc/trades",
    );
    assert.equal(
      draftRoomUrl("abc", env),
      "https://app.example.com/league/abc/draft",
    );
  });

  it("rewrites localhost absolute URLs in production", () => {
    assert.equal(
      absoluteAppUrl("http://localhost:3000/league/abc/trades", {
        nodeEnv: "production",
        appUrl: "https://app.example.com",
      }),
      "https://app.example.com/league/abc/trades",
    );
  });
});
