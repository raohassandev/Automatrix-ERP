"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type PermissionCatalogGroup = {
  module: string;
  permissions: Array<{ key: string; label: string }>;
};

type RoleTemplate = {
  id: string;
  name: string;
  permissionKeys: string[];
};

type UserSummary = {
  id: string;
  name: string | null;
  email: string;
  roleName: string;
  overrideCount: number;
  allowCount: number;
  denyCount: number;
};

type SelectedUser = {
  id: string;
  name: string | null;
  email: string;
  roleName: string;
  overrides: Array<{ permissionKey: string; effect: "ALLOW" | "DENY"; reason: string | null }>;
  effectivePermissions: string[];
};

type ApprovalStage = {
  id: string;
  stageNumber: number;
  stageLabel: string;
  amountFrom: number;
  amountTo: number | null;
  roleIds: string[];
  roleNames: string[];
};

type ApprovalRouteModule = {
  module: string;
  moduleLabel: string;
  stages: ApprovalStage[];
};

type RoleOption = { id: string; name: string };

type AccessTab = "roles" | "users" | "routes";
type OverrideEffect = "INHERIT" | "ALLOW" | "DENY";

function moduleLabel(module: string) {
  return module.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AccessControlCenter() {
  const [tab, setTab] = useState<AccessTab>("roles");

  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [roleCatalog, setRoleCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [roleDraft, setRoleDraft] = useState<Set<string>>(new Set());
  const [savingRole, setSavingRole] = useState(false);

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [userCatalog, setUserCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [userOverrideDraft, setUserOverrideDraft] = useState<Record<string, OverrideEffect>>({});
  const [savingUser, setSavingUser] = useState(false);

  const [approvalRoles, setApprovalRoles] = useState<RoleOption[]>([]);
  const [approvalModules, setApprovalModules] = useState<ApprovalRouteModule[]>([]);
  const [savingRouteId, setSavingRouteId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId) || null, [roles, selectedRoleId]);

  const loadRoleTemplates = async () => {
    const res = await fetch("/api/access-control/roles", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load role templates");
    }

    setRoles(data.roles || []);
    setRoleCatalog(data.permissionCatalog || []);

    const firstRoleId = (data.roles?.[0]?.id as string | undefined) || "";
    const nextRoleId = selectedRoleId || firstRoleId;
    setSelectedRoleId(nextRoleId);

    const roleForDraft = (data.roles || []).find((role: RoleTemplate) => role.id === nextRoleId);
    setRoleDraft(new Set(roleForDraft?.permissionKeys || []));
  };

  const loadUserOverrides = async (userId?: string) => {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await fetch(`/api/access-control/user-overrides${query}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load user overrides");
    }

    setUsers(data.users || []);
    setUserCatalog(data.permissionCatalog || []);

    const resolvedUserId = userId || selectedUserId || data.users?.[0]?.id || "";
    if (resolvedUserId && resolvedUserId !== userId) {
      await loadUserOverrides(resolvedUserId);
      return;
    }

    setSelectedUserId(resolvedUserId);
    setSelectedUser(data.selectedUser || null);

    const draft: Record<string, OverrideEffect> = {};
    for (const group of data.permissionCatalog || []) {
      for (const permission of group.permissions || []) {
        draft[permission.key] = "INHERIT";
      }
    }

    for (const override of data.selectedUser?.overrides || []) {
      draft[override.permissionKey] = override.effect;
    }
    setUserOverrideDraft(draft);
  };

  const loadApprovalRoutes = async () => {
    const res = await fetch("/api/access-control/approval-routes", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load approval routes");
    }
    setApprovalRoles(data.roles || []);
    setApprovalModules(data.approvalRoutes || []);
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadRoleTemplates(), loadUserOverrides(), loadApprovalRoutes()]);
      } catch (error) {
        if (!isMounted) return;
        toast.error(error instanceof Error ? error.message : "Failed to load access control center");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleRolePermission = (permissionKey: string) => {
    setRoleDraft((prev) => {
      const next = new Set(prev);
      if (next.has(permissionKey)) {
        next.delete(permissionKey);
      } else {
        next.add(permissionKey);
      }
      return next;
    });
  };

  const saveRoleTemplate = async () => {
    if (!selectedRoleId) return;
    setSavingRole(true);
    try {
      const res = await fetch("/api/access-control/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: selectedRoleId, permissionKeys: Array.from(roleDraft) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save role template");
      }
      toast.success("Role template updated");
      await loadRoleTemplates();
      await loadUserOverrides(selectedUserId || undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save role template");
    } finally {
      setSavingRole(false);
    }
  };

  const saveUserOverrides = async () => {
    if (!selectedUserId) return;
    setSavingUser(true);

    try {
      const payload = Object.entries(userOverrideDraft)
        .filter(([, effect]) => effect !== "INHERIT")
        .map(([permissionKey, effect]) => ({
          permissionKey,
          effect,
          reason: null,
        }));

      const res = await fetch("/api/access-control/user-overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, overrides: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save user overrides");
      }

      toast.success("User feature overrides updated");
      await loadUserOverrides(selectedUserId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save user overrides");
    } finally {
      setSavingUser(false);
    }
  };

  const saveApprovalStage = async (moduleKey: string, stage: ApprovalStage) => {
    setSavingRouteId(stage.id);
    try {
      const res = await fetch("/api/access-control/approval-routes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: stage.id,
          amountFrom: stage.amountFrom,
          amountTo: stage.amountTo,
          roleIds: stage.roleIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save approval stage");
      }
      toast.success(`${moduleLabel(moduleKey)} route updated`);
      await loadApprovalRoutes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save approval route");
    } finally {
      setSavingRouteId(null);
    }
  };

  const updateApprovalStage = (moduleKey: string, stageId: string, updater: (stage: ApprovalStage) => ApprovalStage) => {
    setApprovalModules((prev) =>
      prev.map((module) => {
        if (module.module !== moduleKey) return module;
        return {
          ...module,
          stages: module.stages.map((stage) => (stage.id === stageId ? updater(stage) : stage)),
        };
      })
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Control Center</CardTitle>
          <CardDescription>Loading role templates, feature matrix, and approval routes...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 bg-gradient-to-b from-slate-50 to-white">
      <CardHeader>
        <CardTitle className="text-xl text-slate-900">Access Control Center</CardTitle>
        <CardDescription className="text-slate-600">
          Business-first access governance: role templates, user feature toggles, and approval routes by amount.
        </CardDescription>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={tab === "roles" ? "default" : "outline"}
            onClick={() => setTab("roles")}
            className={tab === "roles" ? "bg-blue-600 hover:bg-blue-700" : "border-blue-200 text-blue-700 hover:bg-blue-50"}
          >
            Role Templates
          </Button>
          <Button
            type="button"
            variant={tab === "users" ? "default" : "outline"}
            onClick={() => setTab("users")}
            className={tab === "users" ? "bg-emerald-600 hover:bg-emerald-700" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}
          >
            User Feature Access
          </Button>
          <Button
            type="button"
            variant={tab === "routes" ? "default" : "outline"}
            onClick={() => setTab("routes")}
            className={tab === "routes" ? "bg-amber-600 hover:bg-amber-700" : "border-amber-200 text-amber-700 hover:bg-amber-50"}
          >
            Approval Routes
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {tab === "roles" ? (
          <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">Role templates</div>
              <div className="space-y-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoleId(role.id);
                      setRoleDraft(new Set(role.permissionKeys));
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedRoleId === role.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-medium text-slate-900">{role.name}</div>
                    <div className="text-xs text-slate-500">{role.permissionKeys.length} features enabled</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <div className="text-sm text-slate-500">Editing template</div>
                  <div className="text-lg font-semibold text-slate-900">{selectedRole?.name || "Select role"}</div>
                </div>
                <Badge variant="outline" className="border-blue-200 text-blue-700">
                  {roleDraft.size} enabled features
                </Badge>
              </div>

              {roleCatalog.map((group) => (
                <div key={group.module} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 text-sm font-semibold text-slate-800">{moduleLabel(group.module)}</div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {group.permissions.map((permission) => (
                      <label
                        key={permission.key}
                        className="flex items-center gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={roleDraft.has(permission.key)}
                          onChange={() => toggleRolePermission(permission.key)}
                        />
                        <span className="text-slate-700">{permission.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Button onClick={saveRoleTemplate} disabled={savingRole || !selectedRoleId} className="bg-blue-600 hover:bg-blue-700">
                  {savingRole ? "Saving..." : "Save Role Template"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "users" ? (
          <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">Users</div>
              <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => loadUserOverrides(user.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedUserId === user.id
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-medium text-slate-900">{user.name || user.email}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="outline">{user.roleName}</Badge>
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                        {user.allowCount} allow
                      </Badge>
                      <Badge variant="outline" className="border-rose-200 text-rose-700">
                        {user.denyCount} deny
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-sm text-slate-500">Selected user</div>
                <div className="text-lg font-semibold text-slate-900">{selectedUser?.name || selectedUser?.email || "Select user"}</div>
                {selectedUser ? (
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span>Base role: {selectedUser.roleName}</span>
                    <span>Effective features: {selectedUser.effectivePermissions.length}</span>
                  </div>
                ) : null}
              </div>

              {userCatalog.map((group) => (
                <div key={group.module} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 text-sm font-semibold text-slate-800">{moduleLabel(group.module)}</div>
                  <div className="space-y-2">
                    {group.permissions.map((permission) => (
                      <div key={permission.key} className="grid gap-2 rounded border border-slate-100 bg-slate-50 p-2 sm:grid-cols-[1fr,200px] sm:items-center">
                        <div>
                          <div className="text-sm font-medium text-slate-800">{permission.label}</div>
                          <div className="text-xs text-slate-500">{permission.key}</div>
                        </div>
                        <select
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                          value={userOverrideDraft[permission.key] || "INHERIT"}
                          onChange={(event) =>
                            setUserOverrideDraft((prev) => ({
                              ...prev,
                              [permission.key]: event.target.value as OverrideEffect,
                            }))
                          }
                        >
                          <option value="INHERIT">Inherit Role</option>
                          <option value="ALLOW">Allow</option>
                          <option value="DENY">Deny</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Button
                  onClick={saveUserOverrides}
                  disabled={savingUser || !selectedUserId}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {savingUser ? "Saving..." : "Save User Access"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "routes" ? (
          <div className="space-y-4">
            {approvalModules.map((moduleEntry) => (
              <div key={moduleEntry.module} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{moduleEntry.moduleLabel} approval routes</h3>
                  <Badge variant="outline" className="border-amber-200 text-amber-700">
                    {moduleEntry.stages.length} stages
                  </Badge>
                </div>

                <div className="space-y-3">
                  {moduleEntry.stages.map((stage) => (
                    <div key={stage.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="grid gap-3 md:grid-cols-[140px,1fr] md:items-start">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-500">Stage</div>
                          <div className="text-sm font-semibold text-slate-900">{stage.stageLabel}</div>
                        </div>
                        <div className="space-y-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="text-sm text-slate-700">
                              From amount
                              <Input
                                type="number"
                                min={0}
                                value={stage.amountFrom}
                                onChange={(event) =>
                                  updateApprovalStage(moduleEntry.module, stage.id, (prev) => ({
                                    ...prev,
                                    amountFrom: Number(event.target.value || 0),
                                  }))
                                }
                              />
                            </label>
                            <label className="text-sm text-slate-700">
                              To amount (blank = open)
                              <Input
                                type="number"
                                min={0}
                                value={stage.amountTo ?? ""}
                                onChange={(event) =>
                                  updateApprovalStage(moduleEntry.module, stage.id, (prev) => ({
                                    ...prev,
                                    amountTo: event.target.value === "" ? null : Number(event.target.value),
                                  }))
                                }
                              />
                            </label>
                          </div>

                          <div>
                            <div className="mb-1 text-sm font-medium text-slate-700">Approver roles</div>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {approvalRoles.map((role) => (
                                <label key={role.id} className="flex items-center gap-2 rounded border border-slate-100 bg-white px-2 py-1.5 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={stage.roleIds.includes(role.id)}
                                    onChange={() =>
                                      updateApprovalStage(moduleEntry.module, stage.id, (prev) => {
                                        const set = new Set(prev.roleIds);
                                        if (set.has(role.id)) {
                                          set.delete(role.id);
                                        } else {
                                          set.add(role.id);
                                        }
                                        return {
                                          ...prev,
                                          roleIds: Array.from(set),
                                        };
                                      })
                                    }
                                  />
                                  <span>{role.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button
                              onClick={() => saveApprovalStage(moduleEntry.module, stage)}
                              disabled={savingRouteId === stage.id}
                              className="bg-amber-600 hover:bg-amber-700"
                            >
                              {savingRouteId === stage.id ? "Saving..." : "Save Stage"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
