"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MobileCard } from "@/components/MobileCard";
import { taskPriorityClasses, taskStatusClasses, TASK_INTERVAL_TYPES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks";

type WorkspaceTask = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  progress: number;
  sourceType: string;
  projectId: string;
  projectRef: string;
  projectName: string;
  assignedToId: string;
  assignedToName: string;
  assignedToEmail: string;
  reviewedByName: string;
  reviewScore: number | null;
  reviewNotes: string;
  reviewedAt: string;
  templateId: string;
  templateTitle: string;
  instanceDate: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceTemplate = {
  id: string;
  title: string;
  description: string;
  priority: string;
  intervalType: string;
  intervalValue: number;
  weekdays: string;
  dayOfMonth: number | null;
  dueAfterDays: number;
  startDate: string;
  endDate: string;
  nextRunAt: string;
  isActive: boolean;
  projectId: string;
  projectRef: string;
  projectName: string;
  assignedToId: string;
  assignedToName: string;
  assignedToEmail: string;
};

type ProjectOption = { id: string; projectId: string; name: string; status: string };
type UserOption = { id: string; name: string; email: string };

type TasksWorkspaceProps = {
  currentUserId: string;
  canViewAll: boolean;
  canManage: boolean;
  canUpdateAssigned: boolean;
  canReview: boolean;
  canManageTemplates: boolean;
  initialTasks: WorkspaceTask[];
  initialTemplates: WorkspaceTemplate[];
  projects: ProjectOption[];
  users: UserOption[];
};

type Tab = "tasks" | "templates";

const EMPTY_TASK_FORM = {
  projectId: "",
  title: "",
  description: "",
  priority: "MEDIUM",
  dueDate: "",
  assignedToId: "",
};

const EMPTY_TEMPLATE_FORM = {
  projectId: "",
  title: "",
  description: "",
  priority: "MEDIUM",
  intervalType: "WEEKLY",
  intervalValue: "1",
  weekdays: "1,2,3,4,5",
  dayOfMonth: "",
  dueAfterDays: "0",
  startDate: "",
  endDate: "",
  assignedToId: "",
};

function isOverdue(status: string, dueDate: string) {
  if (!dueDate) return false;
  const s = String(status || "").toUpperCase();
  if (s === "DONE" || s === "CANCELLED") return false;
  return new Date(dueDate).getTime() < new Date(new Date().toISOString().slice(0, 10)).getTime();
}

export function TasksWorkspace({
  currentUserId,
  canViewAll,
  canManage,
  canUpdateAssigned,
  canReview,
  canManageTemplates,
  initialTasks,
  initialTemplates,
  projects,
  users,
}: TasksWorkspaceProps) {
  const [tab, setTab] = useState<Tab>("tasks");
  const [tasks, setTasks] = useState<WorkspaceTask[]>(initialTasks);
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>(initialTemplates);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [onlyMine, setOnlyMine] = useState(true);

  const [taskForm, setTaskForm] = useState(() => ({
    ...EMPTY_TASK_FORM,
    projectId: projects[0]?.id || "",
  }));
  const [creatingTask, setCreatingTask] = useState(false);

  const [templateForm, setTemplateForm] = useState(() => ({
    ...EMPTY_TEMPLATE_FORM,
    projectId: projects[0]?.id || "",
  }));
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [runningRecurrence, setRunningRecurrence] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((row) => row.status === "TODO").length;
    const inProgress = tasks.filter((row) => row.status === "IN_PROGRESS").length;
    const done = tasks.filter((row) => row.status === "DONE").length;
    const blocked = tasks.filter((row) => row.status === "BLOCKED").length;
    const overdue = tasks.filter((row) => isOverdue(row.status, row.dueDate)).length;
    return { total, todo, inProgress, done, blocked, overdue };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((row) => {
      if (onlyMine && row.assignedToId !== currentUserId && row.createdById !== currentUserId) return false;
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && row.priority !== priorityFilter) return false;
      if (projectFilter !== "ALL" && row.projectId !== projectFilter) return false;
      if (!q) return true;
      return (
        `${row.title} ${row.description} ${row.projectRef} ${row.projectName} ${row.assignedToName} ${row.assignedToEmail}`
          .toLowerCase()
          .includes(q)
      );
    });
  }, [tasks, query, onlyMine, statusFilter, priorityFilter, projectFilter, currentUserId]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((row) => {
      if (projectFilter !== "ALL" && row.projectId !== projectFilter) return false;
      if (!q) return true;
      return `${row.title} ${row.description} ${row.projectRef} ${row.projectName} ${row.assignedToName} ${row.intervalType}`
        .toLowerCase()
        .includes(q);
    });
  }, [templates, query, projectFilter]);

  async function refreshTasks() {
    const params = new URLSearchParams();
    if (!canViewAll || onlyMine) params.set("scope", "my");
    const res = await fetch(`/api/tasks?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to refresh tasks");
    }
    setTasks(
      (data.data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id || ""),
        title: String(row.title || ""),
        description: String(row.description || ""),
        status: String(row.status || "TODO"),
        priority: String(row.priority || "MEDIUM"),
        dueDate: row.dueDate ? new Date(String(row.dueDate)).toISOString().slice(0, 10) : "",
        progress: Number(row.progress || 0),
        sourceType: String(row.sourceType || "MANUAL"),
        projectId: String((row.project as Record<string, unknown>)?.id || ""),
        projectRef: String((row.project as Record<string, unknown>)?.projectId || ""),
        projectName: String((row.project as Record<string, unknown>)?.name || ""),
        assignedToId: String(row.assignedToId || ""),
        assignedToName: String((row.assignedTo as Record<string, unknown>)?.name || (row.assignedTo as Record<string, unknown>)?.email || ""),
        assignedToEmail: String((row.assignedTo as Record<string, unknown>)?.email || ""),
        reviewedByName: String((row.reviewedBy as Record<string, unknown>)?.name || (row.reviewedBy as Record<string, unknown>)?.email || ""),
        reviewScore: row.reviewScore !== null && row.reviewScore !== undefined ? Number(row.reviewScore) : null,
        reviewNotes: String(row.reviewNotes || ""),
        reviewedAt: row.reviewedAt ? String(row.reviewedAt) : "",
        templateId: String(row.templateId || ""),
        templateTitle: String((row.template as Record<string, unknown>)?.title || ""),
        instanceDate: row.instanceDate ? new Date(String(row.instanceDate)).toISOString().slice(0, 10) : "",
        createdById: String(row.createdById || ""),
        createdByName: String((row.createdBy as Record<string, unknown>)?.name || (row.createdBy as Record<string, unknown>)?.email || ""),
        createdAt: String(row.createdAt || ""),
        updatedAt: String(row.updatedAt || ""),
      })),
    );
  }

  async function refreshTemplates() {
    const res = await fetch("/api/tasks/templates", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to refresh templates");
    }
    setTemplates(
      (data.data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id || ""),
        title: String(row.title || ""),
        description: String(row.description || ""),
        priority: String(row.priority || "MEDIUM"),
        intervalType: String(row.intervalType || "WEEKLY"),
        intervalValue: Number(row.intervalValue || 1),
        weekdays: String(row.weekdays || ""),
        dayOfMonth: row.dayOfMonth ? Number(row.dayOfMonth) : null,
        dueAfterDays: Number(row.dueAfterDays || 0),
        startDate: new Date(String(row.startDate)).toISOString().slice(0, 10),
        endDate: row.endDate ? new Date(String(row.endDate)).toISOString().slice(0, 10) : "",
        nextRunAt: String(row.nextRunAt || ""),
        isActive: Boolean(row.isActive),
        projectId: String(row.projectId || ""),
        projectRef: String((row.project as Record<string, unknown>)?.projectId || ""),
        projectName: String((row.project as Record<string, unknown>)?.name || ""),
        assignedToId: String(row.assignedToId || ""),
        assignedToName: String((row.assignedTo as Record<string, unknown>)?.name || (row.assignedTo as Record<string, unknown>)?.email || ""),
        assignedToEmail: String((row.assignedTo as Record<string, unknown>)?.email || ""),
      })),
    );
  }

  async function createTask() {
    if (!taskForm.projectId || !taskForm.title.trim()) {
      toast.error("Project and title are required.");
      return;
    }
    setCreatingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: taskForm.projectId,
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || undefined,
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || undefined,
          assignedToId: taskForm.assignedToId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create task");
      }
      toast.success("Task created.");
      setTaskForm({ ...EMPTY_TASK_FORM, projectId: taskForm.projectId });
      await refreshTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  }

  async function saveTask(task: WorkspaceTask, payload: Record<string, unknown>) {
    setSavingTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save task");
      }
      toast.success("Task updated.");
      await refreshTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save task");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function createTemplate() {
    if (!templateForm.projectId || !templateForm.title.trim() || !templateForm.startDate) {
      toast.error("Project, title, and start date are required.");
      return;
    }
    setCreatingTemplate(true);
    try {
      const res = await fetch("/api/tasks/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: templateForm.projectId,
          title: templateForm.title.trim(),
          description: templateForm.description.trim() || undefined,
          priority: templateForm.priority,
          intervalType: templateForm.intervalType,
          intervalValue: Number(templateForm.intervalValue || 1),
          weekdays: templateForm.weekdays || undefined,
          dayOfMonth: templateForm.dayOfMonth ? Number(templateForm.dayOfMonth) : undefined,
          dueAfterDays: Number(templateForm.dueAfterDays || 0),
          startDate: templateForm.startDate,
          endDate: templateForm.endDate || undefined,
          assignedToId: templateForm.assignedToId || undefined,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create template");
      }
      toast.success("Recurring template created.");
      setTemplateForm({ ...EMPTY_TEMPLATE_FORM, projectId: templateForm.projectId });
      await refreshTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create template");
    } finally {
      setCreatingTemplate(false);
    }
  }

  async function saveTemplate(templateId: string, payload: Record<string, unknown>) {
    setSavingTemplateId(templateId);
    try {
      const res = await fetch(`/api/tasks/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save template");
      }
      toast.success("Template updated.");
      await refreshTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setSavingTemplateId(null);
    }
  }

  async function runRecurrence() {
    setRunningRecurrence(true);
    try {
      const res = await fetch("/api/tasks/recurrence/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to run recurrence");
      }
      const created = Number(data?.data?.generated || 0);
      toast.success(`Recurring task run complete. Created ${created} task(s).`);
      await Promise.all([refreshTasks(), refreshTemplates()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run recurrence");
    } finally {
      setRunningRecurrence(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Task Management</h1>
            <p className="mt-2 text-muted-foreground">
              Track assignments, execution, review quality, and recurring operational tasks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={tab === "tasks" ? "default" : "outline"} onClick={() => setTab("tasks")}>
              Tasks
            </Button>
            <Button variant={tab === "templates" ? "default" : "outline"} onClick={() => setTab("templates")}>
              Recurring Templates
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm md:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Search task/project/assignee..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">All priorities</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="ALL">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectId} - {project.name}
              </option>
            ))}
          </select>
        </div>
        {tab === "tasks" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                disabled={!canViewAll}
              />
              Show only my ownership scope
            </label>
          </div>
        ) : null}
      </div>

      {tab === "tasks" ? (
        <>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
              <div className="text-xs text-sky-700 dark:text-sky-300">Total</div>
              <div className="text-xl font-semibold text-sky-900 dark:text-sky-100">{summary.total}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
              <div className="text-xs text-amber-700 dark:text-amber-300">To Do</div>
              <div className="text-xl font-semibold text-amber-900 dark:text-amber-100">{summary.todo}</div>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
              <div className="text-xs text-indigo-700 dark:text-indigo-300">In Progress</div>
              <div className="text-xl font-semibold text-indigo-900 dark:text-indigo-100">{summary.inProgress}</div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
              <div className="text-xs text-rose-700 dark:text-rose-300">Blocked</div>
              <div className="text-xl font-semibold text-rose-900 dark:text-rose-100">{summary.blocked}</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="text-xs text-emerald-700 dark:text-emerald-300">Done</div>
              <div className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">{summary.done}</div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-100/70 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
              <div className="text-xs text-rose-700 dark:text-rose-300">Overdue</div>
              <div className="text-xl font-semibold text-rose-900 dark:text-rose-100">{summary.overdue}</div>
            </div>
          </div>

          {canManage ? (
            <details className="rounded-xl border bg-card p-4 shadow-sm md:p-6" open>
              <summary className="cursor-pointer text-sm font-semibold">Create New Task</summary>
              <div className="mt-4 grid gap-3 md:grid-cols-6">
                <div className="space-y-1 md:col-span-2">
                  <Label>Project</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={taskForm.projectId}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, projectId: e.target.value }))}
                  >
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.projectId} - {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Title</Label>
                  <Input value={taskForm.title} onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}
                  >
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Due Date</Label>
                  <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                </div>
                <div className="space-y-1 md:col-span-4">
                  <Label>Description</Label>
                  <Textarea rows={3} value={taskForm.description} onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Assignee</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={taskForm.assignedToId}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, assignedToId: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.name || u.email) + " - " + u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-6 flex justify-end">
                  <Button onClick={createTask} disabled={creatingTask}>
                    {creatingTask ? "Creating..." : "Create Task"}
                  </Button>
                </div>
              </div>
            </details>
          ) : null}

          <div className="rounded-xl border bg-card p-4 shadow-sm md:p-6">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Task</th>
                    <th className="py-2">Project</th>
                    <th className="py-2">Assignee</th>
                    <th className="py-2">Priority</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Progress</th>
                    <th className="py-2">Due</th>
                    <th className="py-2">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const canUpdateRow = canManage || (canUpdateAssigned && task.assignedToId === currentUserId);
                    const canReviewRow = canReview;
                    return (
                      <tr key={task.id} className="border-b align-top">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{task.title}</div>
                          {task.description ? <div className="text-xs text-muted-foreground">{task.description}</div> : null}
                          {task.templateTitle ? (
                            <div className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
                              Recurring: {task.templateTitle}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{task.projectRef}</div>
                          <div className="text-xs text-muted-foreground">{task.projectName}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <div>{task.assignedToName || "-"}</div>
                          <div className="text-xs text-muted-foreground">{task.assignedToEmail || "-"}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${taskPriorityClasses(task.priority)}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                            value={task.status}
                            disabled={!canUpdateRow || savingTaskId === task.id}
                            onChange={(e) => saveTask(task, { status: e.target.value })}
                          >
                            {TASK_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="w-20"
                            value={String(task.progress)}
                            disabled={!canUpdateRow || savingTaskId === task.id}
                            onChange={(e) => {
                              const next = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                              setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, progress: next } : row)));
                            }}
                            onBlur={(e) => {
                              const next = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                              if (next !== task.progress) {
                                void saveTask(task, { progress: next });
                              }
                            }}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            type="date"
                            className="w-36"
                            value={task.dueDate || ""}
                            disabled={!canManage || savingTaskId === task.id}
                            onChange={(e) => setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, dueDate: e.target.value } : row)))}
                            onBlur={(e) => {
                              if (canManage) void saveTask(task, { dueDate: e.target.value || "" });
                            }}
                          />
                          {isOverdue(task.status, task.dueDate) ? (
                            <div className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">Overdue</div>
                          ) : null}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {task.reviewScore ? (
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${taskStatusClasses("DONE")}`}>
                                Score {task.reviewScore}/5
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not reviewed</span>
                            )}
                            {canReviewRow ? (
                              <>
                                <select
                                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                                  defaultValue={task.reviewScore ? String(task.reviewScore) : ""}
                                  onChange={(e) =>
                                    void saveTask(task, {
                                      reviewScore: e.target.value ? Number(e.target.value) : null,
                                      reviewNotes: task.reviewNotes || null,
                                    })
                                  }
                                >
                                  <option value="">Score</option>
                                  <option value="1">1</option>
                                  <option value="2">2</option>
                                  <option value="3">3</option>
                                  <option value="4">4</option>
                                  <option value="5">5</option>
                                </select>
                                {task.status === "DONE" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void saveTask(task, { reopen: true })}
                                    disabled={savingTaskId === task.id}
                                  >
                                    Reopen
                                  </Button>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {filteredTasks.map((task) => {
                const canUpdateRow = canManage || (canUpdateAssigned && task.assignedToId === currentUserId);
                return (
                  <MobileCard
                    key={task.id}
                    title={task.title}
                    subtitle={`${task.projectRef} • ${task.assignedToName || "Unassigned"}`}
                    fields={[
                      { label: "Priority", value: <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${taskPriorityClasses(task.priority)}`}>{task.priority}</span> },
                      { label: "Status", value: <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${taskStatusClasses(task.status)}`}>{task.status}</span> },
                      { label: "Progress", value: `${task.progress}%` },
                      { label: "Due", value: task.dueDate || "-" },
                    ]}
                    actions={
                      <div className="grid w-full grid-cols-1 gap-2">
                        <select
                          className="rounded-md border border-border bg-background px-2 py-2 text-xs"
                          value={task.status}
                          disabled={!canUpdateRow || savingTaskId === task.id}
                          onChange={(e) => void saveTask(task, { status: e.target.value })}
                        >
                          {TASK_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={String(task.progress)}
                          disabled={!canUpdateRow || savingTaskId === task.id}
                          onChange={(e) => {
                            const next = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                            setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, progress: next } : row)));
                          }}
                          onBlur={(e) => {
                            const next = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                            if (next !== task.progress) {
                              void saveTask(task, { progress: next });
                            }
                          }}
                        />
                      </div>
                    }
                  />
                );
              })}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No tasks found for current filters.</div>
            ) : null}
          </div>
        </>
      ) : null}

      {tab === "templates" ? (
        <>
          {canManageTemplates ? (
            <details className="rounded-xl border bg-card p-4 shadow-sm md:p-6" open>
              <summary className="cursor-pointer text-sm font-semibold">Create Recurring Template</summary>
              <div className="mt-4 grid gap-3 md:grid-cols-6">
                <div className="space-y-1 md:col-span-2">
                  <Label>Project</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={templateForm.projectId}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, projectId: e.target.value }))}
                  >
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.projectId} - {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Template Title</Label>
                  <Input value={templateForm.title} onChange={(e) => setTemplateForm((prev) => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={templateForm.priority}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, priority: e.target.value }))}
                  >
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Assignee</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={templateForm.assignedToId}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, assignedToId: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.name || u.email) + " - " + u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label>Description</Label>
                  <Textarea rows={3} value={templateForm.description} onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Interval Type</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={templateForm.intervalType}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, intervalType: e.target.value }))}
                  >
                    {TASK_INTERVAL_TYPES.map((intervalType) => (
                      <option key={intervalType} value={intervalType}>
                        {intervalType}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Interval Value</Label>
                  <Input type="number" min={1} value={templateForm.intervalValue} onChange={(e) => setTemplateForm((prev) => ({ ...prev, intervalValue: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Weekdays (0-6)</Label>
                  <Input placeholder="1,2,3,4,5" value={templateForm.weekdays} onChange={(e) => setTemplateForm((prev) => ({ ...prev, weekdays: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Day of Month</Label>
                  <Input type="number" min={1} max={31} value={templateForm.dayOfMonth} onChange={(e) => setTemplateForm((prev) => ({ ...prev, dayOfMonth: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Due After (days)</Label>
                  <Input type="number" min={0} value={templateForm.dueAfterDays} onChange={(e) => setTemplateForm((prev) => ({ ...prev, dueAfterDays: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="date" value={templateForm.startDate} onChange={(e) => setTemplateForm((prev) => ({ ...prev, startDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>End Date</Label>
                  <Input type="date" value={templateForm.endDate} onChange={(e) => setTemplateForm((prev) => ({ ...prev, endDate: e.target.value }))} />
                </div>
                <div className="md:col-span-6 flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={runRecurrence} disabled={runningRecurrence}>
                    {runningRecurrence ? "Running..." : "Run Recurrence Now"}
                  </Button>
                  <Button onClick={createTemplate} disabled={creatingTemplate}>
                    {creatingTemplate ? "Saving..." : "Create Template"}
                  </Button>
                </div>
              </div>
            </details>
          ) : null}

          <div className="rounded-xl border bg-card p-4 shadow-sm md:p-6">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Template</th>
                    <th className="py-2">Project</th>
                    <th className="py-2">Schedule</th>
                    <th className="py-2">Next Run</th>
                    <th className="py-2">Assignee</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.map((template) => (
                    <tr key={template.id} className="border-b">
                      <td className="py-2">
                        <div className="font-medium">{template.title}</div>
                        {template.description ? <div className="text-xs text-muted-foreground">{template.description}</div> : null}
                      </td>
                      <td className="py-2">
                        <div className="font-medium">{template.projectRef}</div>
                        <div className="text-xs text-muted-foreground">{template.projectName}</div>
                      </td>
                      <td className="py-2">
                        <div className="text-xs">
                          {template.intervalType} x{template.intervalValue}
                        </div>
                        {template.weekdays ? <div className="text-xs text-muted-foreground">Weekdays: {template.weekdays}</div> : null}
                        {template.dayOfMonth ? <div className="text-xs text-muted-foreground">Day: {template.dayOfMonth}</div> : null}
                      </td>
                      <td className="py-2 text-xs">{new Date(template.nextRunAt).toLocaleString()}</td>
                      <td className="py-2">
                        <div>{template.assignedToName || "-"}</div>
                        <div className="text-xs text-muted-foreground">{template.assignedToEmail || "-"}</div>
                      </td>
                      <td className="py-2">
                        {canManageTemplates ? (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${template.isActive ? taskStatusClasses("IN_PROGRESS") : taskStatusClasses("CANCELLED")}`}>
                              {template.isActive ? "ACTIVE" : "PAUSED"}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void saveTemplate(template.id, { isActive: !template.isActive })}
                              disabled={savingTemplateId === template.id}
                            >
                              {template.isActive ? "Pause" : "Activate"}
                            </Button>
                          </div>
                        ) : (
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${template.isActive ? taskStatusClasses("IN_PROGRESS") : taskStatusClasses("CANCELLED")}`}>
                            {template.isActive ? "ACTIVE" : "PAUSED"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {filteredTemplates.map((template) => (
                <MobileCard
                  key={template.id}
                  title={template.title}
                  subtitle={`${template.projectRef} • ${template.intervalType} x${template.intervalValue}`}
                  fields={[
                    { label: "Assignee", value: template.assignedToName || "-" },
                    { label: "Next Run", value: new Date(template.nextRunAt).toLocaleDateString() },
                    { label: "Status", value: template.isActive ? "ACTIVE" : "PAUSED" },
                  ]}
                  actions={
                    canManageTemplates ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void saveTemplate(template.id, { isActive: !template.isActive })}
                        disabled={savingTemplateId === template.id}
                      >
                        {template.isActive ? "Pause" : "Activate"}
                      </Button>
                    ) : null
                  }
                />
              ))}
            </div>
            {filteredTemplates.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No templates found for current filters.</div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
