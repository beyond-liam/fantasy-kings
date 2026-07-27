import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateImageUrl, isValidImageUrl } from "./image-url";

describe("validateImageUrl", () => {
  describe("HTTPS requirement", () => {
    it("rejects empty URLs", () => {
      const result = validateImageUrl("");
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "URL is required");
      }
    });

    it("rejects http:// URLs", () => {
      const result = validateImageUrl("http://example.com/logo.png", {
        allowlistSupabase: false,
      });
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "Image URL must use HTTPS");
      }
    });

    it("rejects javascript: scheme", () => {
      const result = validateImageUrl("javascript:alert('xss')", {
        allowlistSupabase: false,
      });
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "Invalid URL scheme");
      }
    });

    it("rejects javascript: scheme case-insensitive", () => {
      const result = validateImageUrl("JAVASCRIPT:alert('xss')", {
        allowlistSupabase: false,
      });
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "Invalid URL scheme");
      }
    });

    it("accepts https:// URLs when allowlist is disabled", () => {
      const result = validateImageUrl("https://example.com/logo.png", {
        allowlistSupabase: false,
      });
      assert.equal(result.valid, true);
    });

    it("accepts https:// URLs with query params", () => {
      const result = validateImageUrl(
        "https://example.com/logo.png?v=123&size=large",
        { allowlistSupabase: false }
      );
      assert.equal(result.valid, true);
    });

    it("trims whitespace", () => {
      const result = validateImageUrl(
        "  https://example.com/logo.png  ",
        { allowlistSupabase: false }
      );
      assert.equal(result.valid, true);
    });
  });

  describe("Supabase allowlist", () => {
    it("rejects non-Supabase URLs when allowlist is enabled and env is set", () => {
      const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";

      try {
        const result = validateImageUrl("https://example.com/logo.png", {
          allowlistSupabase: true,
        });
        assert.equal(result.valid, false);
        if (!result.valid) {
          assert.match(result.error, /must be from/);
        }
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
      }
    });

    it("accepts Supabase URLs when allowlist is enabled", () => {
      const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";

      try {
        const result = validateImageUrl(
          "https://abc123.supabase.co/storage/v1/object/public/logos/test.png",
          { allowlistSupabase: true }
        );
        assert.equal(result.valid, true);
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
      }
    });

    it("accepts any HTTPS URL when env var is not set", () => {
      const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      try {
        const result = validateImageUrl("https://example.com/logo.png", {
          allowlistSupabase: true,
        });
        assert.equal(result.valid, true);
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
      }
    });

    it("rejects invalid URL format", () => {
      const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc123.supabase.co";

      try {
        const result = validateImageUrl("https://not a valid url", {
          allowlistSupabase: true,
        });
        assert.equal(result.valid, false);
        if (!result.valid) {
          assert.equal(result.error, "Invalid URL format");
        }
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
      }
    });
  });
});

describe("isValidImageUrl", () => {
  it("returns true for valid HTTPS URLs", () => {
    assert.equal(
      isValidImageUrl("https://example.com/logo.png", {
        allowlistSupabase: false,
      }),
      true
    );
  });

  it("returns false for http:// URLs", () => {
    assert.equal(
      isValidImageUrl("http://example.com/logo.png", {
        allowlistSupabase: false,
      }),
      false
    );
  });

  it("returns false for javascript: scheme", () => {
    assert.equal(
      isValidImageUrl("javascript:alert('xss')", { allowlistSupabase: false }),
      false
    );
  });
});
