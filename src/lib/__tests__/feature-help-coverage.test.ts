import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { resolveFeatureHelp } from "@/lib/feature-help";

function collectAppRoutes(): string[] {
  const appRoot = path.join(process.cwd(), "src", "app");
  const routes: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile() || entry.name !== "page.tsx") continue;
      const rel = path.relative(appRoot, full).replace(/\\/g, "/");
      const routePath = rel === "page.tsx" ? "" : rel.replace(/\/page\.tsx$/, "");
      const route = `/${routePath.replace(/\[(.*?)\]/g, "sample-id")}`.replace(/\/$/, "") || "/";
      routes.push(route === "" ? "/" : route);
    }
  }

  walk(appRoot);
  return Array.from(new Set(routes)).sort();
}

describe("feature-help coverage", () => {
  test("all app routes resolve to non-dashboard contextual help except dashboard root", () => {
    const routes = collectAppRoutes();
    const allowedDashboardFallback = new Set<string>(["/", "/dashboard"]);

    for (const route of routes) {
      const help = resolveFeatureHelp(route);
      if (allowedDashboardFallback.has(route)) {
        expect(help.id).toBe("dashboard");
      } else {
        expect(help.id, `missing contextual mapping for ${route}`).not.toBe("dashboard");
      }
    }
  });
});
