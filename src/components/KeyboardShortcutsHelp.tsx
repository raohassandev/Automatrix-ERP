"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Keyboard } from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const shortcuts = [
  { keys: ["⌘", "E"], description: "Submit Expense" },
  { keys: ["⌘", "I"], description: "Log Income" },
  { keys: ["⌘", "⇧", "E"], description: "Add Employee" },
  { keys: ["⌘", "⇧", "P"], description: "Create Project" },
  { keys: ["⌘", "⇧", "C"], description: "Create Client" },
  { keys: ["⌘", "⇧", "I"], description: "Add Inventory Item" },
  { keys: ["⌘", "⇧", "N"], description: "Create Invoice" },
  { keys: ["⌘", "/"], description: "Show Keyboard Shortcuts" },
  { keys: ["Esc"], description: "Close Dialogs" },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  // Register shortcut to open this dialog
  useKeyboardShortcuts({
    'cmd+/': () => setOpen(true),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
        title="Keyboard Shortcuts (⌘/)"
      >
        <Keyboard className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              Use these shortcuts to quickly navigate and perform actions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent"
              >
                <span className="text-sm text-foreground">
                  {shortcut.description}
                </span>
                <div className="flex gap-1">
                  {shortcut.keys.map((key, i) => (
                    <kbd
                      key={i}
                      className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            <p>⌘ = Cmd (Mac) or Ctrl (Windows/Linux)</p>
            <p>⇧ = Shift</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
