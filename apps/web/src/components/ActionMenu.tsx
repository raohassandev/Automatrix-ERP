"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Plus,
  Users,
  FolderKanban,
  Package,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { FormDialogManager, type FormType } from "./FormDialogManager";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface ActionMenuItem {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
  color: string;
  show: boolean;
}

interface ActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActionMenu({ isOpen, onClose }: ActionMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [openFormDialog, setOpenFormDialog] = useState<FormType>(null);

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    'cmd+e': () => {
      setOpenFormDialog('expense');
      onClose();
    },
    'cmd+i': () => {
      setOpenFormDialog('income');
      onClose();
    },
    'cmd+shift+e': () => {
      setOpenFormDialog('employee');
      onClose();
    },
    'cmd+shift+p': () => {
      setOpenFormDialog('project');
      onClose();
    },
    'cmd+shift+i': () => {
      setOpenFormDialog('inventory');
      onClose();
    },
    'cmd+shift+n': () => {
      setOpenFormDialog('invoice');
      onClose();
    },
  });

  // Define all available actions
  const actions: ActionMenuItem[] = [
    {
      icon: Plus,
      label: "Submit Expense",
      description: "Add a new expense entry",
      onClick: () => {
        setOpenFormDialog("expense");
        onClose();
      },
      color: "bg-red-500/10 text-red-600 dark:text-red-400",
      show: true, // Always show
    },
    {
      icon: TrendingUp,
      label: "Log Income",
      description: "Record income received",
      onClick: () => {
        setOpenFormDialog("income");
        onClose();
      },
      color: "bg-green-500/10 text-green-600 dark:text-green-400",
      show: true, // Always show
    },
    {
      icon: Users,
      label: "Add Employee",
      description: "Create new employee record",
      onClick: () => {
        setOpenFormDialog("employee");
        onClose();
      },
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      show: true, // Always show
    },
    {
      icon: FolderKanban,
      label: "Create Project",
      description: "Start a new project",
      onClick: () => {
        setOpenFormDialog("project");
        onClose();
      },
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      show: true, // Always show
    },
    {
      icon: Package,
      label: "Add Inventory",
      description: "Add new inventory item",
      onClick: () => {
        setOpenFormDialog("inventory");
        onClose();
      },
      color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      show: true, // Always show
    },
    {
      icon: FileText,
      label: "Create Invoice",
      description: "Generate new invoice",
      onClick: () => {
        setOpenFormDialog("invoice");
        onClose();
      },
      color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
      show: true, // Always show
    },
  ];

  const visibleActions = actions.filter((action) => action.show);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: 0.03,
        staggerDirection: -1,
      },
    },
  };

  const itemVariants = {
    hidden: { 
      y: 20, 
      opacity: 0,
      scale: 0.9,
    },
    visible: { 
      y: 0, 
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 24,
      },
    },
    exit: { 
      y: 20, 
      opacity: 0,
      scale: 0.9,
      transition: {
        duration: 0.15,
      },
    },
  };

  return (
    <>
      <FormDialogManager 
        openForm={openFormDialog} 
        onClose={() => setOpenFormDialog(null)} 
      />
      
      <AnimatePresence>
        {isOpen && (
        <>
          {/* Desktop: Floating menu */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="hidden md:flex fixed bottom-24 right-6 z-40 flex-col-reverse gap-3 w-72"
          >
            {visibleActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.label}
                  variants={itemVariants}
                  onClick={action.onClick}
                  className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-left"
                  whileHover={{ x: -4 }}
                >
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-lg ${action.color} flex items-center justify-center`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground">
                      {action.label}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {action.description}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Mobile: Bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-card border-t border-border rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto"
          >
            {/* Handle bar */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Menu items */}
            <div className="px-4 pb-6 space-y-2">
              <h3 className="text-lg font-semibold mb-4 text-foreground">
                Quick Actions
              </h3>
              {visibleActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className="w-full flex items-center gap-4 p-4 bg-background rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-lg ${action.color} flex items-center justify-center`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground">
                        {action.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
