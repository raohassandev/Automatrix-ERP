type EnvLike = Record<string, string | undefined>;

function norm(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

export function isLocalhostUrl(url: string | undefined) {
  const v = norm(url);
  return (
    v.startsWith("http://localhost") ||
    v.startsWith("https://localhost") ||
    v.startsWith("http://127.0.0.1") ||
    v.startsWith("https://127.0.0.1")
  );
}

export function isProdDomainUrl(url: string | undefined) {
  const v = norm(url);
  return v.includes("erp.automatrix.pk") && !v.includes("erp-staging.automatrix.pk");
}

export function isStagingDomainUrl(url: string | undefined) {
  const v = norm(url);
  return v.includes("erp-staging.automatrix.pk");
}

export function isCredentialsModeAllowed(env: EnvLike) {
  if (env.AUTH_ENABLE_CREDENTIALS !== "1") return false;
  const nextAuthUrl = env.NEXTAUTH_URL;

  // Allowed only for staging domain or localhost/dev.
  const allowedDomain = isStagingDomainUrl(nextAuthUrl) || isLocalhostUrl(nextAuthUrl);
  const forbiddenProd = isProdDomainUrl(nextAuthUrl);

  return allowedDomain && !forbiddenProd;
}

export function assertCredentialsModeAllowed(env: EnvLike) {
  if (env.AUTH_ENABLE_CREDENTIALS !== "1") return;
  if (isCredentialsModeAllowed(env)) return;

  throw new Error(
    [
      "SECURITY GUARD: AUTH_ENABLE_CREDENTIALS=1 is not allowed in this environment.",
      `- NODE_ENV=${env.NODE_ENV || ""}`,
      `- NEXTAUTH_URL=${env.NEXTAUTH_URL || ""}`,
      "",
      "Allowed only when NEXTAUTH_URL is staging domain or localhost.",
      "Forbidden on production domain (erp.automatrix.pk).",
    ].join("\n"),
  );
}
