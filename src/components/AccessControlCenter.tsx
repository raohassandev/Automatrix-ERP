"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";

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
type AccessMode = "YES" | "NO" | "SELF" | "CUSTOM";

type PermissionRow = {
  key: string;
  label: string;
  supportsSelf: boolean;
  ownKey?: string;
};

function moduleLabel(module: string) {
  return module.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toPermissionRows(group: PermissionCatalogGroup): PermissionRow[] {
  const keySet = new Set(group.permissions.map((p) => p.key));
  const rows: PermissionRow[] = [];

  for (const permission of group.permissions) {
    if (permission.key.endsWith(".view_own")) {
      const allKey = permission.key.replace(/\.view_own$/, ".view_all");
      if (keySet.has(allKey)) {
        continue;
      }
    }

    if (permission.key.endsWith(".view_all")) {
      const ownKey = permission.key.replace(/\.view_all$/, ".view_own");
      rows.push({
        key: permission.key,
        label: permission.label,
        supportsSelf: keySet.has(ownKey),
        ownKey: keySet.has(ownKey) ? ownKey : undefined,
      });
      continue;
    }

    rows.push({
      key: permission.key,
      label: permission.label,
      supportsSelf: false,
    });
  }

  return rows;
}

function getRoleMode(row: PermissionRow, selected: Set<string>): AccessMode {
  if (row.supportsSelf && row.ownKey) {
    if (selected.has(row.key)) return "YES";
    if (selected.has(row.ownKey)) return "SELF";
    return "NO";
  }

  return selected.has(row.key) ? "YES" : "NO";
}

function applyRoleMode(row: PermissionRow, mode: AccessMode, selected: Set<string>) {
  const next = new Set(selected);

  if (row.supportsSelf && row.ownKey) {
    next.delete(row.key);
    next.delete(row.ownKey);
    if (mode === "YES") {
      next.add(row.key);
    } else if (mode === "SELF") {
      next.add(row.ownKey);
    } else if (mode === "CUSTOM") {
      // For now, custom behaves as self-scope until rule-builder is added.
      next.add(row.ownKey);
    }
    return next;
  }

  if (mode === "YES") {
    next.add(row.key);
  } else {
    next.delete(row.key);
  }
  return next;
}

export default function AccessControlCenter() {
  const [tab, setTab] = useState<AccessTab>("roles");

  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [roleCatalog, setRoleCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [roleDraft, setRoleDraft] = useState<Set<string>>(new Set());
  const [savingRole, setSavingRole] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

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

  const openRoleDialog = (role: RoleTemplate) => {
    setSelectedRoleId(role.id);
    setRoleDraft(new Set(role.permissionKeys));
    setRoleDialogOpen(true);
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
      toast.success("Role permissions updated");
      setRoleDialogOpen(false);
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
          <CardDescription>Loading roles and permissions...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 bg-gradient-to-b from-slate-50 to-white">
      <CardHeader>
        <CardTitle className="text-xl text-slate-900">Access Control Center</CardTitle>
        <CardDescription className="text-slate-600">
          Configure role templates, user-level access, and approval routes with business-friendly controls.
        </CardDescription>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant={tab === "roles" ? "default" : "outline"} onClick={() => setTab("roles")}>Role Templates</Button>
          <Button type="button" variant={tab === "users" ? "default" : "outline"} onClick={() => setTab("users")}>User Access</Button>
          <Button type="button" variant={tab === "routes" ? "default" : "outline"} onClick={() => setTab("routes")}>Approval Routes</Button>
        </div>
      </CardHeader>

      <CardContent>
        {tab === "roles" && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="grid grid-cols-[1.2fr,140px,360px] gap-3 border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <div>Role Name</div>
                <div>Archived</div>
                <div>Actions</div>
              </div>
              {roles.map((role) => (
                <div key={role.id} className="grid grid-cols-[1.2fr,140px,360px] gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                  <div>
                    <div className="font-semibold text-slate-900">{role.name}</div>
                    <div className="text-xs text-slate-500">{role.permissionKeys.length} enabled features</div>
                  </div>
                  <div className="text-slate-600">No</div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openRoleDialog(role)}>View Permissions</Button>
                    <Button size="sm" variant="outline" onClick={() => openRoleDialog(role)}>Update</Button>
                  </div>
                </div>
              ))}
            </div>

            <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                  <DialogTitle>View Role: {selectedRole?.name}</DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    `Self` is enabled where `view_all / view_own` pair exists. `Custom` currently maps to self-scope until custom rule builder is added.
                  </div>

                  {roleCatalog.map((group) => {
                    const rows = toPermissionRows(group);
                    const isCollapsed = collapsedModules[group.module] === true;

                    return (
                      <div key={group.module} className="rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                          onClick={() =>
                            setCollapsedModules((prev) => ({
                              ...prev,
                              [group.module]: !prev[group.module],
                            }))
                          }
                        >
                          <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {moduleLabel(group.module)}
                          </div>
                          <Badge variant="outline">{rows.length} actions</Badge>
                        </button>

                        {!isCollapsed && (
                          <div className="border-t">
                            <div className="grid grid-cols-[1.4fr,120px,120px,120px,120px] gap-2 border-b bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                              <div>Permission</div>
                              <div>Yes</div>
                              <div>No</div>
                              <div>Self</div>
                              <div>Custom</div>
                            </div>

                            {rows.map((row) => {
                              const mode = getRoleMode(row, roleDraft);
                              const selfEnabled = row.supportsSelf;
                              return (
                                <div key={row.key} className="grid grid-cols-[1.4fr,120px,120px,120px,120px] gap-2 border-b px-4 py-2 text-sm last:border-b-0">
                                  <div className="text-slate-800">{row.label}</div>
                                  {(["YES", "NO", "SELF", "CUSTOM"] as const).map((option) => (
                                    <label
                                      key={option}
                                      className={`flex items-center gap-2 ${
                                        !selfEnabled && (option === "SELF" || option === "CUSTOM")
                                          ? "cursor-not-allowed text-slate-300"
                                          : "cursor-pointer text-slate-700"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={`${group.module}-${row.key}`}
                                        disabled={!selfEnabled && (option === "SELF" || option === "CUSTOM")}
                                        checked={mode === option}
                                        onChange={() => setRoleDraft((prev) => applyRoleMode(row, option, prev))}
                                      />
                                      {option.charAt(0) + option.slice(1).toLowerCase()}
                                    </label>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Close</Button>
                    <Button onClick={saveRoleTemplate} disabled={savingRole}>
                      {savingRole ? "Saving..." : "Save Permissions"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {tab === "users" && (
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
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700">{user.allowCount} allow</Badge>
                      <Badge variant="outline" className="border-rose-200 text-rose-700">{user.denyCount} deny</Badge>
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
                <Button onClick={saveUserOverrides} disabled={savingUser || !selectedUserId} className="bg-emerald-600 hover:bg-emerald-700">
                  {savingUser ? "Saving..." : "Save User Access"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === "routes" && (
          <div className="space-y-4">
            {approvalModules.map((moduleEntry) => (
              <div key={moduleEntry.module} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{moduleEntry.moduleLabel} approval routes</h3>
                  <Badge variant="outline" className="border-amber-200 text-amber-700">{moduleEntry.stages.length} stages</Badge>
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
                                        if (set.has(role.id)) set.delete(role.id);
                                        else set.add(role.id);
                                        return { ...prev, roleIds: Array.from(set) };
                                      })
                                    }
                                  />
                                  <span>{role.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button onClick={() => saveApprovalStage(moduleEntry.module, stage)} disabled={savingRouteId === stage.id} className="bg-amber-600 hover:bg-amber-700">
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
        )}
      </CardContent>
    </Card>
  );
}
