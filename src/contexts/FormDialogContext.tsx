"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type FormType =
  | "expense"
  | "income"
  | "employee"
  | "project"
  | "client"
  | "inventory"
  | "invoice"
  | "vendor"
  | "department"
  | "designation"
  | null;

interface FormDialogContextType {
  openForm: FormType;
  setOpenForm: (form: FormType) => void;
  closeForm: () => void;
}

const FormDialogContext = createContext<FormDialogContextType | undefined>(undefined);

export function FormDialogProvider({ children }: { children: ReactNode }) {
  const [openForm, setOpenForm] = useState<FormType>(null);

  const closeForm = () => setOpenForm(null);

  return (
    <FormDialogContext.Provider value={{ openForm, setOpenForm, closeForm }}>
      {children}
    </FormDialogContext.Provider>
  );
}

export function useFormDialog() {
  const context = useContext(FormDialogContext);
  if (!context) {
    throw new Error("useFormDialog must be used within FormDialogProvider");
  }
  return context;
}
