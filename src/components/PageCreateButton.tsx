"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormDialogManager, type FormType } from "@/components/FormDialogManager";

interface PageCreateButtonProps {
  label: string;
  formType: FormType;
  queryBackedOpen?: boolean;
}

export function PageCreateButton({ label, formType, queryBackedOpen = false }: PageCreateButtonProps) {
  const [openFormDialog, setOpenFormDialog] = useState<FormType>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createHref = useMemo(() => {
    if (!queryBackedOpen || !formType) return undefined;
    const params = new URLSearchParams(searchParams.toString());
    params.set("create", formType);
    const q = params.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [formType, pathname, queryBackedOpen, searchParams]);

  const queryRequestedOpen =
    queryBackedOpen && formType && searchParams.get("create") === formType ? formType : null;
  const effectiveOpenForm = openFormDialog ?? queryRequestedOpen;

  function closeDialog() {
    setOpenFormDialog(null);
    if (!queryBackedOpen || !formType) return;
    const requested = searchParams.get("create");
    if (requested === formType) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("create");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  }

  return (
    <>
      {queryBackedOpen && createHref ? (
        <Button asChild type="button">
          <a
            href={createHref}
            onClick={(e) => {
              e.preventDefault();
              setOpenFormDialog(formType);
              router.replace(createHref, { scroll: false });
            }}
          >
            {label}
          </a>
        </Button>
      ) : (
        <Button type="button" onClick={() => setOpenFormDialog(formType)}>
          {label}
        </Button>
      )}
      <FormDialogManager openForm={effectiveOpenForm} onClose={closeDialog} />
    </>
  );
}
