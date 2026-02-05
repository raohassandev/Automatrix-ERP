"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { DeleteButton } from "./TableActions";
import { AttachmentEditDialog } from "./AttachmentEditDialog";

type Attachment = {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
};

export function AttachmentActions({ attachment, canEdit }: { attachment: Attachment; canEdit: boolean }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        {canEdit ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <DeleteButton url={`/api/attachments/${attachment.id}`} />
          </>
        ) : null}
      </div>
      {canEdit ? (
        <AttachmentEditDialog open={editOpen} onOpenChange={setEditOpen} attachment={attachment} />
      ) : null}
    </>
  );
}
