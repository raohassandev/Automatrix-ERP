import { request } from "playwright";

const baseURL = process.env.STAGING_BASE_URL || "https://erp-staging.automatrix.pk";
const loginEmail = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";
const loginPassword = process.env.E2E_TEST_PASSWORD || "e2e";
const maxAttempts = Number(process.env.STAGING_RETRY_ATTEMPTS || 8);
const defaultAllowedExtras = [
  // Known template-baseline additions rolled out in Access Control Center.
  "employees.view_client_preview",
  "tasks.assign",
  "tasks.attach_evidence",
  "tasks.close",
  "tasks.grade_completion",
  "tasks.reopen",
  "tasks.verify",
  "tasks.verify_completion",
  "tasks.view_company",
  "tasks.view_company_performance",
  "tasks.view_team",
  "tasks.view_team_performance",
];
const allowedExtraPermissions = new Set(
  [
    ...defaultAllowedExtras,
    ...String(process.env.VERIFY_EFFECTIVE_ALLOWED_EXTRAS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  ].filter(Boolean),
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(ctx, url, options = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await ctx.fetch(url, options);
      const text = await res.text();
      if (!res.ok()) {
        if (/502 Bad Gateway|Internal Server Error|upstream connect error/i.test(text)) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        throw new Error(`${url} -> ${res.status()} ${text.slice(0, 300)}`);
      }
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      await sleep(700 * (attempt + 1));
    }
  }
  throw lastError || new Error(`Failed request: ${url}`);
}

function diffSets(rolePerms, effectivePerms) {
  const missing = [];
  const extra = [];
  const effectiveHasGlobal = effectivePerms.has("*");

  for (const key of rolePerms) {
    if (!effectiveHasGlobal && !effectivePerms.has(key)) missing.push(key);
  }
  for (const key of effectivePerms) {
    if (key === "*") continue;
    if (!rolePerms.has(key) && !allowedExtraPermissions.has(key)) extra.push(key);
  }
  return { missing, extra };
}

async function main() {
  const ctx = await request.newContext({ baseURL });

  const csrf = await fetchJsonWithRetry(ctx, `${baseURL}/api/auth/csrf`);
  await ctx.post(`${baseURL}/api/auth/callback/credentials`, {
    form: {
      csrfToken: csrf.csrfToken,
      email: loginEmail,
      password: loginPassword,
      callbackUrl: "/settings",
      json: "true",
    },
  });

  const session = await fetchJsonWithRetry(ctx, `${baseURL}/api/auth/session`);
  if (!session?.user?.email) {
    throw new Error("Could not create authenticated session for verification");
  }

  const rolesJson = await fetchJsonWithRetry(ctx, `${baseURL}/api/access-control/roles`);
  const usersJson = await fetchJsonWithRetry(ctx, `${baseURL}/api/access-control/user-overrides`);

  const rolePermissionsByName = new Map(
    (rolesJson.roles || []).map((role) => [role.name, new Set(role.permissionKeys || [])]),
  );

  const users = usersJson.users || [];
  const noOverrideMismatches = [];
  const overrideUsers = [];

  for (const user of users) {
    const detailJson = await fetchJsonWithRetry(
      ctx,
      `${baseURL}/api/access-control/user-overrides?userId=${encodeURIComponent(user.id)}`,
    );
    const selected = detailJson.selectedUser;
    const rolePerms = rolePermissionsByName.get(user.roleName) || new Set();
    const effectivePerms = new Set(selected?.effectivePermissions || []);
    const { missing, extra } = diffSets(rolePerms, effectivePerms);

    if ((user.overrideCount || 0) > 0) {
      overrideUsers.push({
        email: user.email,
        roleName: user.roleName,
        overrideCount: user.overrideCount || 0,
        allowCount: user.allowCount || 0,
        denyCount: user.denyCount || 0,
        missingFromEffectiveCount: missing.length,
        extraInEffectiveCount: extra.length,
      });
      continue;
    }

    if (missing.length || extra.length) {
      noOverrideMismatches.push({
        email: user.email,
        roleName: user.roleName,
        missingFromEffective: missing,
        extraInEffective: extra,
      });
    }
  }

  const report = {
    checkedAt: new Date().toISOString(),
    baseURL,
    authUser: session.user.email,
    totalUsers: users.length,
    overrideUsers: overrideUsers.length,
    noOverrideUsers: users.length - overrideUsers.length,
    noOverrideMismatchCount: noOverrideMismatches.length,
    noOverrideMismatches,
    overrideUsersSummary: overrideUsers,
  };

  console.log(JSON.stringify(report, null, 2));
  await ctx.dispose();

  if (noOverrideMismatches.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(String(error?.stack || error));
  process.exit(1);
});
