import { describe, it, expect } from "vitest";
import { assertCredentialsModeAllowed, isCredentialsModeAllowed } from "@/lib/auth-credentials-guard";

describe("auth credentials guard", () => {
  it("allows when credentials mode is off", () => {
    expect(
      isCredentialsModeAllowed({
        AUTH_ENABLE_CREDENTIALS: "0",
        NEXTAUTH_URL: "https://erp.automatrix.pk",
      }),
    ).toBe(false);
    expect(() =>
      assertCredentialsModeAllowed({
        AUTH_ENABLE_CREDENTIALS: "0",
        NEXTAUTH_URL: "https://erp.automatrix.pk",
      }),
    ).not.toThrow();
  });

  it("allows credentials on staging domain", () => {
    expect(
      isCredentialsModeAllowed({
        AUTH_ENABLE_CREDENTIALS: "1",
        NEXTAUTH_URL: "https://erp-staging.automatrix.pk",
      }),
    ).toBe(true);
    expect(() =>
      assertCredentialsModeAllowed({
        AUTH_ENABLE_CREDENTIALS: "1",
        NEXTAUTH_URL: "https://erp-staging.automatrix.pk",
      }),
    ).not.toThrow();
  });

  it("allows credentials on localhost", () => {
    expect(
      isCredentialsModeAllowed({
        AUTH_ENABLE_CREDENTIALS: "1",
        NEXTAUTH_URL: "http://127.0.0.1:3000",
      }),
    ).toBe(true);
  });

  it("blocks credentials on production domain", () => {
    expect(
      isCredentialsModeAllowed({
        AUTH_ENABLE_CREDENTIALS: "1",
        NEXTAUTH_URL: "https://erp.automatrix.pk",
      }),
    ).toBe(false);
    expect(() =>
      assertCredentialsModeAllowed({
        AUTH_ENABLE_CREDENTIALS: "1",
        NEXTAUTH_URL: "https://erp.automatrix.pk",
      }),
    ).toThrow(/SECURITY GUARD/);
  });
});
