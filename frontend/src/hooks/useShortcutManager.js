/**
 * useShortcutManager — Centralized Keyboard Shortcut Manager
 *
 * Three-layer architecture:
 * 1. Zustand store (useShortcutStore) — registry of all shortcuts + UI state
 * 2. React Context (ShortcutContext) — module shortcut registration API
 * 3. Hooks (useModuleShortcuts, useIsTyping, useActiveModule) — consumer-facing
 *
 * All shortcuts must work globally unless the user is typing inside an
 * input, textarea, or contenteditable element (enforced in the Provider).
 */
import { create } from "zustand";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";

// ─── Persistence keys ────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  SIDEBAR: "velora_sidebar_collapsed",
  ENABLED: "velora_shortcuts_enabled",
};

// ─── Route-to-module mapping ─────────────────────────────────────────────────

const ROUTE_MODULE_MAP = [
  { pattern: /^\/(executive)?$/, module: "dashboard" },
  { pattern: /^\/sales/, module: "sales" },
  { pattern: /^\/crm/, module: "crm" },
  { pattern: /^\/purchase/, module: "purchase" },
  { pattern: /^\/supplier-portal/, module: "purchase" },
  { pattern: /^\/inventory/, module: "inventory" },
  { pattern: /^\/wms/, module: "inventory" },
  { pattern: /^\/manufacturing/, module: "manufacturing" },
  { pattern: /^\/accounts/, module: "accounts" },
  { pattern: /^\/hrms/, module: "hrms" },
  { pattern: /^\/eam/, module: "eam" },
  { pattern: /^\/executive/, module: "reports" },
  { pattern: /^\/activity/, module: "audit" },
  { pattern: /^\/settings/, module: "settings" },
  { pattern: /^\/company/, module: "settings" },
  { pattern: /^\/branches/, module: "settings" },
  { pattern: /^\/users/, module: "settings" },
  { pattern: /^\/admin/, module: "admin" },
];

/**
 * Derive the active module key from a pathname.
 */
export function getActiveModule(pathname) {
  for (const { pattern, module: mod } of ROUTE_MODULE_MAP) {
    if (pattern.test(pathname)) return mod;
  }
  return null;
}

// ─── Shortcut type ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} ShortcutDef
 * @property {string} id - Unique identifier (e.g. "sales:new-quotation")
 * @property {{ ctrl?: boolean, shift?: boolean, meta?: boolean, alt?: boolean, key: string }} keys
 * @property {string} label - Human-readable label (e.g. "New Quotation")
 * @property {string} category - Group label (e.g. "Global", "Sales")
 * @property {() => void} handler - The action to execute
 * @property {boolean} [preventDefault=true] - Whether to call e.preventDefault()
 */

// ─── Zustand store ───────────────────────────────────────────────────────────

export const useShortcutStore = create((set, get) => ({
  /** Map<moduleName, ShortcutDef[]> */
  moduleShortcuts: {},

  /** ShortcutDef[] — global shortcuts that work everywhere */
  globalShortcuts: [],

  /** Master toggle — reads from localStorage on init */
  enabled: JSON.parse(localStorage.getItem(STORAGE_KEYS.ENABLED) ?? "true"),

  /** Sidebar collapsed state — persisted to localStorage */
  sidebarCollapsed: JSON.parse(
    localStorage.getItem(STORAGE_KEYS.SIDEBAR) ?? "false"
  ),

  /** Whether the shortcuts dialog is open */
  dialogOpen: false,

  /** Whether global search is open (managed by GlobalSearch) */
  searchOpen: false,

  /** Active module derived from current route */
  activeModule: null,

  /** Track open overlays for ESC LIFO stack */
  overlayStack: [],

  // ── Actions ────────────────────────────────────────────────────────────

  /** Register a global shortcut */
  registerGlobal: (shortcut) =>
    set((state) => {
      const filtered = state.globalShortcuts.filter((s) => s.id !== shortcut.id);
      return { globalShortcuts: [...filtered, shortcut] };
    }),

  /** Unregister a global shortcut by id */
  unregisterGlobal: (id) =>
    set((state) => ({
      globalShortcuts: state.globalShortcuts.filter((s) => s.id !== id),
    })),

  /** Register all shortcuts for a module (replaces any existing for that module) */
  registerModule: (moduleKey, shortcuts) =>
    set((state) => ({
      moduleShortcuts: {
        ...state.moduleShortcuts,
        [moduleKey]: shortcuts,
      },
    })),

  /** Unregister all shortcuts for a module */
  unregisterModule: (moduleKey) =>
    set((state) => {
      const { [moduleKey]: _, ...rest } = state.moduleShortcuts;
      return { moduleShortcuts: rest };
    }),

  /** Push an overlay onto the ESC stack */
  pushOverlay: (id) =>
    set((state) => ({
      overlayStack: [...state.overlayStack.filter((o) => o !== id), id],
    })),

  /** Pop the top overlay from the ESC stack */
  popOverlay: (id) =>
    set((state) => ({
      overlayStack: state.overlayStack.filter((o) => o !== id),
    })),

  /** Set master toggle */
  setEnabled: (value) => {
    localStorage.setItem(STORAGE_KEYS.ENABLED, JSON.stringify(value));
    set({ enabled: value });
  },

  /** Toggle sidebar collapse */
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    localStorage.setItem(STORAGE_KEYS.SIDEBAR, JSON.stringify(next));
    set({ sidebarCollapsed: next });
  },

  /** Set sidebar collapsed state directly */
  setSidebarCollapsed: (value) => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR, JSON.stringify(value));
    set({ sidebarCollapsed: value });
  },

  /** Open/close shortcuts dialog */
  setDialogOpen: (value) => set({ dialogOpen: value }),

  /** Toggle shortcuts dialog */
  toggleDialog: () => set((state) => ({ dialogOpen: !state.dialogOpen })),

  /** Set global search open state */
  setSearchOpen: (value) => set({ searchOpen: value }),

  /** Set active module */
  setActiveModule: (moduleKey) => set({ activeModule: moduleKey }),
}));

// ─── Shortcut matching ──────────────────────────────────────────────────────

/**
 * Check if a KeyboardEvent matches a ShortcutDef's keys.
 */
export function matchShortcut(e, shortcut) {
  const k = shortcut.keys;
  const ctrl = k.ctrl ?? false;
  const shift = k.shift ?? false;
  const meta = k.meta ?? false;
  const alt = k.alt ?? false;
  const key = k.key?.toLowerCase();

  // Ctrl or Meta (Cmd on Mac) — either works unless explicitly differentiated
  const hasMod = e.ctrlKey || e.metaKey;
  const wantsMod = ctrl || meta;
  if (ctrl && !e.ctrlKey) return false;
  if (meta && !e.metaKey) return false;
  if (wantsMod && !hasMod) return false;
  if (!wantsMod && hasMod) return false;
  if (e.shiftKey !== shift) return false;
  if (e.altKey !== alt) return false;
  if (key && e.key.toLowerCase() !== key) return false;
  return true;
}

/**
 * Format shortcut keys for display (e.g. "Ctrl + Shift + N").
 */
export function formatKeys(keys) {
  const parts = [];
  if (keys.ctrl) parts.push("Ctrl");
  if (keys.meta) parts.push("⌘");
  if (keys.shift) parts.push("Shift");
  if (keys.alt) parts.push("Alt");
  if (keys.key) {
    // Special-case named keys
    const k = keys.key;
    if (k === "/") parts.push("/");
    else if (k === " ") parts.push("Space");
    else parts.push(k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1));
  }
  return parts.join(" + ");
}

// ─── Input detection ────────────────────────────────────────────────────────

/**
 * Returns true if the user is currently typing in an input field.
 */
export function isTypingElement(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea") return true;
  if (el.isContentEditable) return true;
  if (el.getAttribute?.("role") === "combobox") return true;
  return false;
}

/**
 * Hook that returns a ref to the current "is typing" state.
 * The ref is kept up-to-date on every focus change via a passive listener.
 *
 * IMPORTANT: This hook uses a global focusin/focusout listener on document.
 * It updates a ref (not state) to avoid re-renders on every focus change.
 */
export function useIsTyping() {
  const ref = useRef(false);

  useEffect(() => {
    function check() {
      ref.current = isTypingElement(document.activeElement);
    }
    // Check on focus change
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    // Initial check
    check();
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);

  return ref;
}

// ─── React Context ───────────────────────────────────────────────────────────

export const ShortcutContext = createContext(null);

// ─── Consumer hooks ──────────────────────────────────────────────────────────

/**
 * Register shortcuts for the current module.
 * Automatically unregisters on unmount.
 *
 * @param {string} moduleKey - Module identifier (e.g. "sales", "inventory")
 * @param {ShortcutDef[]} shortcuts - Array of shortcut definitions
 */
export function useModuleShortcuts(moduleKey, shortcuts) {
  const register = useShortcutStore((s) => s.registerModule);
  const unregister = useShortcutStore((s) => s.unregisterModule);

  // Stable reference to avoid infinite loops
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!moduleKey || !shortcutsRef.current?.length) return;
    register(moduleKey, shortcutsRef.current);
    return () => unregister(moduleKey);
  }, [moduleKey, register, unregister]);
}

/**
 * Register a single global shortcut. Cleans up on unmount.
 *
 * @param {ShortcutDef} shortcut
 */
export function useGlobalShortcut(shortcut) {
  const registerGlobal = useShortcutStore((s) => s.registerGlobal);
  const unregisterGlobal = useShortcutStore((s) => s.unregisterGlobal);

  const shortcutRef = useRef(shortcut);
  shortcutRef.current = shortcut;

  useEffect(() => {
    const sc = shortcutRef.current;
    registerGlobal(sc);
    return () => unregisterGlobal(sc.id);
  }, [registerGlobal, unregisterGlobal]);
}

/**
 * Derive the active module from the current pathname.
 * Updates the store when the module changes.
 *
 * @param {string} pathname - window.location.pathname
 */
export function useActiveModule(pathname) {
  const setActiveModule = useShortcutStore((s) => s.setActiveModule);

  const moduleKey = useMemo(() => getActiveModule(pathname), [pathname]);

  useEffect(() => {
    setActiveModule(moduleKey);
  }, [moduleKey, setActiveModule]);

  return moduleKey;
}

/**
 * Register an overlay on the ESC close stack.
 * Call this from overlays (dialogs, drawers, search) to participate
 * in the ESC-close behavior.
 *
 * @param {string} id - Unique overlay id
 * @param {boolean} isOpen - Whether the overlay is currently open
 */
export function useOverlayStack(id, isOpen) {
  const pushOverlay = useShortcutStore((s) => s.pushOverlay);
  const popOverlay = useShortcutStore((s) => s.popOverlay);

  useEffect(() => {
    if (isOpen) {
      pushOverlay(id);
    } else {
      popOverlay(id);
    }
    return () => popOverlay(id);
  }, [id, isOpen, pushOverlay, popOverlay]);
}
