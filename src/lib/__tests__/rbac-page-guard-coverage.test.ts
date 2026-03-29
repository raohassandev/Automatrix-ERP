import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

function collectPageFiles(): string[] {
  const appRoot = path.join(process.cwd(), "src", "app");
  const out: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name === "page.tsx") {
        out.push(full);
      }
    }
  }

  walk(appRoot);
  return out.sort();
}

describe("rbac/page guard coverage", () => {
  test("every non-public page has at least one auth/permission guard pattern", () => {
    const pages = collectPageFiles();
    const publicPages = new Set<string>([
      path.join(process.cwd(), "src", "app", "page.tsx"),
      path.join(process.cwd(), "src", "app", "login", "page.tsx"),
      path.join(process.cwd(), "src", "app", "forbidden", "page.tsx"),
      path.join(process.cwd(), "src", "app", "help", "page.tsx"),
    ]);

    const guardPatterns = [
      "requirePermission(",
      "auth()",
      "resolveHrmsScope(",
      "getProjectDetailForUser(",
      "getVendorDetailForUser(",
      "getItemDetailForUser(",
      "useEffectivePermissions(",
      "redirect(\"/login\")",
      "You do not have access",
      "Forbidden",
    ];

    for (const page of pages) {
      if (publicPages.has(page)) continue;
      const content = fs.readFileSync(page, "utf8");
      const hasGuardSignal = guardPatterns.some((p) => content.includes(p));
      expect(hasGuardSignal, `missing guard signal in ${path.relative(process.cwd(), page)}`).toBe(true);
    }
  });
});
