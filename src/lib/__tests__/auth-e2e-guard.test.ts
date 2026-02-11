import { describe, it, expect } from "vitest";
import { assertE2eTestModeAllowed } from "@/lib/auth-e2e-guard";

describe("auth e2e guard", () => {
  it("allows when E2E_TEST_MODE is off", () => {
    expect(() =>
      assertE2eTestModeAllowed({
        E2E_TEST_MODE: "0",
        NODE_ENV: "production",
        NEXTAUTH_URL: "https://erp-staging.automatrix.pk",
      }),
    ).not.toThrow();
  });

  it("rejects E2E_TEST_MODE in production", () => {
    expect(() =>
      assertE2eTestModeAllowed({
        E2E_TEST_MODE: "1",
        NODE_ENV: "production",
        NEXTAUTH_URL: "http://127.0.0.1:3000",
      }),
    ).toThrow(/SECURITY GUARD/);
  });

  it("rejects E2E_TEST_MODE on staging/prod domains even if NODE_ENV is mis-set", () => {
    expect(() =>
      assertE2eTestModeAllowed({
        E2E_TEST_MODE: "1",
        NODE_ENV: "test",
        NEXTAUTH_URL: "https://erp-staging.automatrix.pk",
      }),
    ).toThrow(/SECURITY GUARD/);
  });

  it("rejects E2E_TEST_MODE when not CI/test", () => {
    expect(() =>
      assertE2eTestModeAllowed({
        E2E_TEST_MODE: "1",
        NODE_ENV: "development",
        CI: "false",
        NEXTAUTH_URL: "http://127.0.0.1:3000",
      }),
    ).toThrow(/Allowed only/);
  });

  it("allows E2E_TEST_MODE in CI when NEXTAUTH_URL is localhost", () => {
    expect(() =>
      assertE2eTestModeAllowed({
        E2E_TEST_MODE: "1",
        CI: "true",
        NODE_ENV: "production",
        NEXTAUTH_URL: "http://127.0.0.1:3000",
      }),
    ).not.toThrow();
  });
});
