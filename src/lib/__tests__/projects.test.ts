import { describe, expect, test } from "vitest";
import { buildProjectAliases } from "@/lib/projects";

describe("project aliases", () => {
  test("includes canonical and combined refs", () => {
    const aliases = buildProjectAliases({
      id: "proj_db_id",
      projectId: "AE-PV-IS-463",
      name: "China Engineering Company",
    });

    expect(aliases).toContain("proj_db_id");
    expect(aliases).toContain("AE-PV-IS-463");
    expect(aliases).toContain("China Engineering Company");
    expect(aliases).toContain("AE-PV-IS-463 - China Engineering Company");
    expect(aliases).toContain("AE-PV-IS-463-China Engineering Company");
  });
});

