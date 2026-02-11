type EnvLike = Record<string, string | undefined>;

function isLocalhostUrl(url: string) {
  const v = url.trim().toLowerCase();
  return (
    v.startsWith("http://localhost") ||
    v.startsWith("https://localhost") ||
    v.startsWith("http://127.0.0.1") ||
    v.startsWith("https://127.0.0.1")
  );
}

function isProdLikeUrl(url: string) {
  const v = url.trim().toLowerCase();
  return v.includes("erp.automatrix.pk") || v.includes("erp-staging.automatrix.pk");
}

/**
 * Phase 1 security rule:
 * - E2E_TEST_MODE must never be possible to enable in staging/prod by env accident.
 * - Allow only in CI/test AND only on localhost NEXTAUTH_URL.
 *
 * Throws a hard error if E2E_TEST_MODE is enabled in a forbidden environment.
 */
export function assertE2eTestModeAllowed(env: EnvLike) {
  const e2eMode = env.E2E_TEST_MODE === "1";
  if (!e2eMode) return;

  const nodeEnv = (env.NODE_ENV || "").toLowerCase();
  const ci = env.CI === "true";
  const nextAuthUrl = env.NEXTAUTH_URL || "";

  const allowedBecauseTest =
    (nodeEnv === "test" || ci) && isLocalhostUrl(nextAuthUrl);

  // Hard blocks: never allow on real staging/prod domains.
  const forbiddenBecauseProdDomain = isProdLikeUrl(nextAuthUrl);

  // Additional safety: if someone points to a non-localhost URL in production, block.
  // This still allows CI "production-like" runs on localhost.
  const forbiddenBecauseProdAndNotLocalhost =
    nodeEnv === "production" && !isLocalhostUrl(nextAuthUrl);

  if (forbiddenBecauseProdDomain || forbiddenBecauseProdAndNotLocalhost || !allowedBecauseTest) {
    throw new Error(
      [
        "SECURITY GUARD: E2E_TEST_MODE is not allowed in this environment.",
        `- NODE_ENV=${env.NODE_ENV || ""}`,
        `- CI=${env.CI || ""}`,
        `- NEXTAUTH_URL=${nextAuthUrl}`,
        "",
        "Allowed only when:",
        "- (NODE_ENV === 'test' OR CI === 'true')",
        "- AND NEXTAUTH_URL is localhost/127.0.0.1",
      ].join("\n"),
    );
  }
}
