"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { Plus, X } from "lucide-react";

interface Project {
  id: string;
  projectId: string;
  name: string;
  clientName: string;
  contractValue: number;
  costToDate: number;
}

interface InvoiceFormProps {
  projects?: Project[];
  onClose?: () => void;
}

export default function InvoiceForm({ projects = [], onClose }: InvoiceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [loadedProjects, setLoadedProjects] = useState<Project[]>(projects);
  const [form, setForm] = useState({
    invoiceNo: "",
    projectId: "",
    date: new Date().toISOString().split('T')[0],
    amount: "",
    dueDate: "",
    status: "DRAFT",
    notes: "",
  });

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      // Fetch projects if not provided
      fetch('/api/projects')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const mapped = (data.data || []).map((project: { client?: { name?: string } | null }) => ({
              ...project,
              clientName: project.client?.name || "",
            }));
            setLoadedProjects(mapped);
          }
        })
        .catch(console.error);
    }
  }, [projects]);

  const handleProjectChange = (projectId: string) => {
    const project = loadedProjects.find(p => p.projectId === projectId);
    setSelectedProject(project || null);
    setForm(prev => ({ ...prev, projectId }));
    
    // Generate invoice number
    if (project) {
      const timestamp = Date.now().toString().slice(-6);
      const newInvoiceNo = `INV-${projectId}-${timestamp}`;
      setForm(prev => ({ ...prev, invoiceNo: newInvoiceNo }));
    }
  };

  const handleDateChange = (date: string) => {
    setForm(prev => ({ ...prev, date }));
    
    // Auto-calculate due date (30 days later)
    if (date) {
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + 30);
      setForm(prev => ({ ...prev, dueDate: dueDate.toISOString().split('T')[0] }));
    }
  };

  async function submit() {
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
      }),
    });

    if (response.ok) {
      setShowForm(false);
      setForm({
        invoiceNo: "",
        projectId: "",
        date: new Date().toISOString().split('T')[0],
        amount: "",
        dueDate: "",
        status: "DRAFT",
        notes: "",
      });
      setSelectedProject(null);
      router.refresh();
      onClose?.();
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PAID': return 'default';
      case 'SENT': return 'secondary';
      case 'OVERDUE': return 'destructive';
      case 'DRAFT': return 'outline';
      default: return 'outline';
    }
  };

  if (!showForm) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Button onClick={() => setShowForm(true)} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Create New Invoice
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Create New Invoice</CardTitle>
            <CardDescription>Generate a professional invoice for your project</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowForm(false);
              onClose?.();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="invoiceNo">Invoice Number</Label>
            <Input
              id="invoiceNo"
              value={form.invoiceNo}
              onChange={(e) => setForm(prev => ({ ...prev, invoiceNo: e.target.value }))}
              placeholder="e.g., INV-001"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">DRAFT</Badge>
                    <span>Draft</span>
                  </div>
                </SelectItem>
                <SelectItem value="SENT">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">SENT</Badge>
                    <span>Sent to Client</span>
                  </div>
                </SelectItem>
                <SelectItem value="PAID">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">PAID</Badge>
                    <span>Paid</span>
                  </div>
                </SelectItem>
                <SelectItem value="OVERDUE">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">OVERDUE</Badge>
                    <span>Overdue</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectId">Project</Label>
          <Select value={form.projectId} onValueChange={handleProjectChange} required>
            <SelectTrigger>
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {loadedProjects.map((project) => (
                <SelectItem key={project.id} value={project.projectId}>
                  <div className="flex flex-col">
                    <span className="font-medium">{project.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {project.projectId} • {project.clientName} • {formatMoney(project.contractValue)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProject && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="grid gap-2 md:grid-cols-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Client:</span>
                  <p className="font-medium">{selectedProject.clientName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contract Value:</span>
                  <p className="font-medium">{formatMoney(selectedProject.contractValue)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cost to Date:</span>
                  <p className="font-medium">{formatMoney(selectedProject.costToDate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <Label htmlFor="amount">Invoice Amount</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
            placeholder="0.00"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="date">Invoice Date</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => handleDateChange(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Description/Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Invoice description or additional notes..."
            rows={3}
          />
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              setShowForm(false);
              onClose?.();
            }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => startTransition(submit)} 
            disabled={pending}
          >
            {pending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
