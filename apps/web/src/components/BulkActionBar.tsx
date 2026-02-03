"use client";

import { Button } from "./ui/button";
import { Trash2, Check, X, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BulkActionBarProps {
  selectedCount: number;
  onDelete?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onExport?: () => void;
  onClear: () => void;
}

/**
 * BulkActionBar - Floating action bar for bulk operations
 * Appears at the bottom when items are selected
 */
export function BulkActionBar({
  selectedCount,
  onDelete,
  onApprove,
  onReject,
  onExport,
  onClear,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="bg-card border border-border rounded-lg shadow-2xl p-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              {selectedCount}
            </div>
            <span className="text-sm font-medium">
              {selectedCount === 1 ? "1 item selected" : `${selectedCount} items selected`}
            </span>
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex gap-2">
            {onApprove && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={onApprove}
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
            )}
            
            {onReject && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={onReject}
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
            )}

            {onExport && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={onExport}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}

            {onDelete && (
              <Button
                size="sm"
                variant="destructive"
                className="gap-2"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
            >
              Clear
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
