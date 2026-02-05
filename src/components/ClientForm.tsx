"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Contact = {
  name: string;
  phone?: string;
  designation?: string;
  email?: string;
};

interface ClientFormProps {
  onCreated?: () => void;
  onSaved?: () => void;
  showHeader?: boolean;
  initialData?: {
    id: string;
    name: string;
    description?: string | null;
    address?: string | null;
    contacts?: Contact[];
  };
}

export function ClientForm({ onCreated, onSaved, showHeader = true, initialData }: ClientFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const emptyForm = {
    name: "",
    description: "",
    address: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [contacts, setContacts] = useState<Contact[]>([{ name: "", phone: "", designation: "", email: "" }]);
  const isEdit = Boolean(initialData?.id);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        description: initialData.description || "",
        address: initialData.address || "",
      });
      setContacts(
        initialData.contacts && initialData.contacts.length > 0
          ? initialData.contacts.map((c) => ({
              name: c.name || "",
              phone: c.phone || "",
              designation: c.designation || "",
              email: c.email || "",
            }))
          : [{ name: "", phone: "", designation: "", email: "" }]
      );
    } else {
      setForm(emptyForm);
      setContacts([{ name: "", phone: "", designation: "", email: "" }]);
    }
  }, [initialData]);

  const updateContact = (index: number, key: keyof Contact, value: string) => {
    setContacts((prev) =>
      prev.map((contact, i) => (i === index ? { ...contact, [key]: value } : contact))
    );
  };

  const addContact = () => {
    setContacts((prev) => [...prev, { name: "", phone: "", designation: "", email: "" }]);
  };

  const removeContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  async function submit() {
    try {
      const payload = {
        ...form,
        contacts: contacts
          .map((contact) => ({
            name: contact.name.trim(),
            phone: contact.phone?.trim() || undefined,
            designation: contact.designation?.trim() || undefined,
            email: contact.email?.trim() || undefined,
          }))
          .filter((contact) => contact.name.length > 0),
      };

      const res = await fetch(isEdit ? `/api/clients/${initialData?.id}` : "/api/clients", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create client");
      }

      toast.success(isEdit ? "Client updated" : "Client created");
      setForm(emptyForm);
      setContacts([{ name: "", phone: "", designation: "", email: "" }]);
      router.refresh();
      onCreated?.();
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save client");
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      {showHeader ? (
        <>
          <h2 className="text-lg font-semibold">{isEdit ? "Edit Client" : "Create Client"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEdit ? "Update client and contact persons." : "Add a new client and contact persons."}
          </p>
        </>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="client-name">Business Name</Label>
          <Input
            id="client-name"
            placeholder="Fouz Energy"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="client-description">Description</Label>
          <Textarea
            id="client-description"
            placeholder="Client overview or notes"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="client-address">Address</Label>
          <Textarea
            id="client-address"
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Contacts</h3>
          <Button type="button" variant="outline" size="sm" onClick={addContact}>
            Add Contact
          </Button>
        </div>

        {contacts.map((contact, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-4">
            <Input
              placeholder="Contact Name"
              value={contact.name}
              onChange={(e) => updateContact(index, "name", e.target.value)}
            />
            <Input
              placeholder="Contact No"
              value={contact.phone || ""}
              onChange={(e) => updateContact(index, "phone", e.target.value)}
            />
            <Input
              placeholder="Designation (optional)"
              value={contact.designation || ""}
              onChange={(e) => updateContact(index, "designation", e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Email (optional)"
                value={contact.email || ""}
                onChange={(e) => updateContact(index, "email", e.target.value)}
              />
              {contacts.length > 1 ? (
                <Button type="button" variant="outline" onClick={() => removeContact(index)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => startTransition(submit)} disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save Changes" : "Save Client"}
        </Button>
      </div>
    </div>
  );
}
