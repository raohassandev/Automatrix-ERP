"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ActionMenu } from "./ActionMenu";

interface FloatingActionButtonProps {
  pendingApprovalsCount?: number;
}

export function FloatingActionButton({
  pendingApprovalsCount = 0,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Action Menu */}
      <ActionMenu isOpen={isOpen} onClose={() => setIsOpen(false)} />

      {/* FAB Button */}
      <motion.button
        onClick={toggleMenu}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex items-center justify-center group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? "Close menu" : "Open actions menu"}
        aria-expanded={isOpen}
      >
        {/* Pending approvals badge */}
        {pendingApprovalsCount > 0 && !isOpen && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold flex items-center justify-center"
          >
            {pendingApprovalsCount > 9 ? "9+" : pendingApprovalsCount}
          </motion.span>
        )}

        {/* Icon with rotation animation */}
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Plus className="h-6 w-6" />
          )}
        </motion.div>
      </motion.button>

      {/* Mobile: Smaller FAB */}
      <style jsx global>{`
        @media (max-width: 640px) {
          .fixed.bottom-6.right-6.z-50 {
            bottom: 1rem;
            right: 1rem;
            height: 3.5rem;
            width: 3.5rem;
          }
        }
      `}</style>
    </>
  );
}
