"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { DeleteButton } from "./TableActions";
import { ClientFormDialog } from "./ClientFormDialog";

type Client = {
  id: string;
  name: string;
  description?: string | null;
  address?: string | null;
  contacts: Array<{
    name: string;
    phone?: string | null;
    designation?: string | null;
    email?: string | null;
  }>;
};

export function ClientActions({ client, canEdit }: { client: Client; canEdit: boolean }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        {canEdit ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <DeleteButton url={`/api/clients/${client.id}`} />
          </>
        ) : null}
      </div>
      {canEdit ? (
        <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} initialData={client} />
      ) : null}
    </>
  );
}
