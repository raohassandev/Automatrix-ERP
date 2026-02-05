"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

type Role = { id: string; name: string };
type Policy = {
  id: string;
  module: string;
  level: string;
  minAmount: number;
  maxAmount: number | null;
  roleIds: string[];
  roleNames: string[];
};

export default function ApprovalPolicyManager() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/approval-policies");
        const data = await res.json();
        if (res.ok) {
          setPolicies(data.policies || []);
          setRoles(data.roles || []);
          const drafts: Record<string, Set<string>> = {};
          for (const policy of data.policies || []) {
            drafts[policy.id] = new Set(policy.roleIds || []);
          }
          setDraftRoles(drafts);
        } else {
          setStatus(data.error || "Failed to load approval policies.");
        }
      } catch (error) {
        setStatus("Failed to load approval policies.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const groupedPolicies = useMemo(() => {
    return policies.reduce<Record<string, Policy[]>>((acc, policy) => {
      if (!acc[policy.module]) acc[policy.module] = [];
      acc[policy.module].push(policy);
      return acc;
    }, {});
  }, [policies]);

  const toggleRole = (policyId: string, roleId: string) => {
    setDraftRoles((prev) => {
      const next = new Set(prev[policyId] || []);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return { ...prev, [policyId]: next };
    });
  };

  const savePolicy = async (policyId: string) => {
    setSavingId(policyId);
    setStatus(null);
    try {
      const roleIds = Array.from(draftRoles[policyId] || []);
      const res = await fetch("/api/approval-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, roleIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        setStatus(data.error || "Failed to update policy.");
        return;
      }
      setPolicies((prev) =>
        prev.map((policy) =>
          policy.id === policyId
            ? {
                ...policy,
                roleIds,
                roleNames: roles.filter((role) => roleIds.includes(role.id)).map((role) => role.name),
              }
            : policy
        )
      );
      setStatus("Approval policy updated.");
    } catch (error) {
      setStatus("Failed to update policy.");
      console.error(error);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval Matrix</CardTitle>
          <CardDescription>Loading approval settings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Approval Matrix</CardTitle>
          <CardDescription>
            Assign which roles can approve each approval level. Changes apply immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.keys(groupedPolicies).length === 0 && (
            <p className="text-sm text-muted-foreground">No approval policies found.</p>
          )}

          {Object.entries(groupedPolicies)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([module, modulePolicies]) => (
            <div key={module} className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold capitalize">{module} approvals</h3>
                <Badge variant="outline">{modulePolicies.length} levels</Badge>
              </div>

              <div className="space-y-4">
                {modulePolicies.map((policy) => {
                  const selectedRoles = draftRoles[policy.id] || new Set<string>();
                  const rangeLabel =
                    policy.maxAmount === null
                      ? `${formatMoney(policy.minAmount)}+`
                      : `${formatMoney(policy.minAmount)} - ${formatMoney(policy.maxAmount)}`;

                  return (
                    <div key={policy.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm text-muted-foreground">Level</div>
                          <div className="text-lg font-semibold">{policy.level}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Amount range</div>
                          <div className="text-sm font-medium">{rangeLabel}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Current roles</div>
                          <div className="text-sm font-medium">
                            {policy.roleNames.length > 0 ? policy.roleNames.join(", ") : "None"}
                          </div>
                        </div>
                        <Button
                          onClick={() => savePolicy(policy.id)}
                          disabled={savingId === policy.id}
                        >
                          {savingId === policy.id ? "Saving..." : "Save"}
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-2 md:grid-cols-3">
                        {roles.map((role) => (
                          <label key={role.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={selectedRoles.has(role.id)}
                              onChange={() => toggleRole(policy.id, role.id)}
                            />
                            <span>{role.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {status && (
            <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
              {status}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
