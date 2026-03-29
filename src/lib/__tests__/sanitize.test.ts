import { describe, expect, it } from "vitest";

import { decodeHtmlEntities, sanitizeString } from "@/lib/sanitize";

describe("sanitizeString", () => {
  it("preserves normal business text characters while trimming input", () => {
    expect(sanitizeString("  Lodging & Travel  ")).toBe("Lodging & Travel");
  });

  it("removes control characters", () => {
    expect(sanitizeString("Fuel\u0007 Claim")).toBe("Fuel Claim");
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes legacy HTML entity strings", () => {
    expect(decodeHtmlEntities("Lodging &amp; Travel: InDrive Al Hafiz")).toBe(
      "Lodging & Travel: InDrive Al Hafiz",
    );
  });
});
