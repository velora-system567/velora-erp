/**
 * KeyboardShortcutProvider — Global keyboard shortcut dispatcher.
 *
 * Mounts a single keydown listener on `document` and dispatches to
 * registered shortcuts from the Zustand store. Wraps the app so
 * every registered shortcut is reachable from any page.
 *
 * Escalation order:
 *   1. ESC — pop the top overlay from the LIFO stack
 *   2. Global shortcuts (registered via registerGlobal)
 *   3. Module shortcuts (registered via useModuleShortcuts for active module)
 *
 * Input safety: when the user is typing in an input/textarea, only ESC
 * and shortcuts typed with a modifier key (Ctrl/⌘) will fire.
 */
import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useShortcutStore,
  useIsTyping,
  matchShortcut,
  ShortcutContext,
} from "../hooks/useShortcutManager";
import KeyboardShortcutsDialog from "./KeyboardShortcutsDialog";

export function KeyboardShortcutProvider({ children }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isTypingRef = useIsTyping();
  const searchInputRef = useRef(null);

  // Keep a ref to navigate to avoid stale closures in global event listener
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Read store values at dispatch time via getState() to avoid stale closures.
  // The useEffect depends on nothing except setting up/tearing down the listener.
  useEffect(() => {
    const qc = queryClient;

    function handler(e) {
      const store = useShortcutStore.getState();
      const nav = navigateRef.current;

      // 1. Skip if shortcuts are disabled
      if (!store.enabled) return;

      // 2. Input safety — when typing in a field, only allow Escape
      //    and shortcuts with a modifier key (Ctrl/⌘)
      if (isTypingRef.current) {
        if (e.key === "Escape") {
          handleEscape(store);
          return;
        }
        // For typed shortcuts, only allow those with Ctrl/Meta
        if (!e.ctrlKey && !e.metaKey && e.key !== "Escape") return;
        // Allow Ctrl+K even when typing (convenience)
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
          e.preventDefault();
          store.setSearchOpen(true);
          return;
        }
        // For all other ctrl shortcuts, fall through to matching
      }

      // 3. Hardcoded global shortcuts (highest priority after ESC)
      //    Ctrl+K — Open Global Search
      if ((e.ctrlKey || e.metaKey) && e.key === "k" && !e.shiftKey) {
        e.preventDefault();
        store.setSearchOpen(true);
        return;
      }

      //    Ctrl+/ — Open Keyboard Shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        store.setDialogOpen(true);
        return;
      }

      //    Ctrl+Shift+S — Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        store.toggleSidebar();
        return;
      }

      //    Ctrl+Shift+D — Go to Dashboard
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
        e.preventDefault();
        nav('/');
        return;
      }

      //    Ctrl+Shift+R — Refresh current module
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "R") {
        e.preventDefault();
        // Invalidate all queries for the active module
        const activeMod = store.activeModule;
        if (activeMod) {
          qc.invalidateQueries({ queryKey: [activeMod] });
        } else {
          qc.invalidateQueries();
        }
        return;
      }

      //    Ctrl+Shift+F — Focus module search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        // Dispatch a custom event that module pages can listen for
        document.dispatchEvent(new CustomEvent("velora:focus-search"));
        return;
      }

      //    Ctrl+Shift+N — New Record (context-aware)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        dispatchNewRecord(store);
        return;
      }

      // 4. Match against global shortcuts
      for (const sc of store.globalShortcuts) {
        if (matchShortcut(e, sc)) {
          if (sc.preventDefault !== false) e.preventDefault();
          sc.handler(e);
          return;
        }
      }

      // 5. Match against active module shortcuts
      const activeModule = store.activeModule;
      if (activeModule && store.moduleShortcuts[activeModule]) {
        for (const sc of store.moduleShortcuts[activeModule]) {
          if (matchShortcut(e, sc)) {
            if (sc.preventDefault !== false) e.preventDefault();
            sc.handler(e);
            return;
          }
        }
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [queryClient]);

  // ── ESC handler ──────────────────────────────────────────────────────────

  const handleEscape = useCallback((store) => {
    // LIFO: pop the top overlay
    const stack = store.overlayStack;
    if (stack.length > 0) {
      const topmost = stack[stack.length - 1];
      // Close based on overlay type
      if (topmost === "search") {
        store.setSearchOpen(false);
      } else if (topmost === "shortcuts-dialog") {
        store.setDialogOpen(false);
      }
      // Close sidebar drawer on mobile
      if (window.innerWidth < 1024 && store.sidebarCollapsed) {
        // Don't toggle — sidebar is already collapsed on mobile,
        // meaning the drawer is showing
      }
      return;
    }
    // Fallback: close sidebar drawer on mobile
    if (window.innerWidth < 1024 && !store.sidebarCollapsed) {
      // On mobile, if sidebar is visible (drawer mode), close it
      store.setSidebarCollapsed(true);
    }
  }, []);

  // ── Ctrl+Shift+N dispatch ────────────────────────────────────────────────

  const dispatchNewRecord = useCallback((store) => {
    const mod = store.activeModule;
    if (!mod) return;

    // If the module has registered a new-record shortcut, it will
    // be matched in the module shortcuts loop below. This is a fallback
    // for modules that haven't registered one yet.
    const navMap = {
      sales: "/sales",
      inventory: "/inventory",
      accounts: "/accounts",
      purchase: "/purchase",
      manufacturing: "/manufacturing",
      crm: "/crm",
      hrms: "/hrms",
      eam: "/eam",
    };
    const path = navMap[mod];
    if (path) {
      navigateRef.current(path);
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ShortcutContext.Provider value={{ searchInputRef }}>
      {children}
      <KeyboardShortcutsDialog />
    </ShortcutContext.Provider>
  );
}
