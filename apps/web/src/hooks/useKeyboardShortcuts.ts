"use client";

import { useEffect } from "react";

type ShortcutHandler = () => void;

interface KeyboardShortcuts {
  [key: string]: ShortcutHandler;
}

/**
 * Hook to register global keyboard shortcuts
 * @param shortcuts - Object mapping key combinations to handlers
 * 
 * Example:
 * useKeyboardShortcuts({
 *   'cmd+e': () => openExpenseForm(),
 *   'cmd+i': () => openIncomeForm(),
 * })
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Build key combination string
      const keys: string[] = [];
      
      if (event.ctrlKey || event.metaKey) keys.push('cmd');
      if (event.shiftKey) keys.push('shift');
      if (event.altKey) keys.push('alt');
      
      // Add the actual key (lowercase)
      const key = event.key.toLowerCase();
      if (key !== 'control' && key !== 'shift' && key !== 'alt' && key !== 'meta') {
        keys.push(key);
      }
      
      const combination = keys.join('+');
      
      // Check if this combination has a handler
      const handler = shortcuts[combination];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}
