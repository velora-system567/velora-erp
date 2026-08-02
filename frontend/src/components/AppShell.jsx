import { useState, useCallback, useEffect, useRef } from "react";
import {
  Activity, BarChart3, Building2, LogOut, Package, Settings,
  ShoppingBag, ShoppingCart, Users, Warehouse, Shield, PanelLeftClose, PanelLeft, X,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { authApi } from "../services/api";
import { usePermissionStore, useVisibleModules } from "../hooks/usePermissions";
import {
  useShortcutStore,
  useActiveModule,
  useOverlayStack,
} from "../hooks/useShortcutManager";
import GlobalSearch from "./GlobalSearch";
import AICopilot from "./AICopilot";

// Icon map for modules
const ICON_MAP = {
  LayoutDashboard: BarChart3,
  ShoppingCart,
  Warehouse,
  Package: ShoppingBag,
  DollarSign: BarChart3,
  Factory: Package,
  Users,
  UserCheck: Users,
  Tool: Package,
  BarChart3,
  ClipboardCheck: Activity,
  Settings,
  Shield,
};

// ─── Navigation Sections (filtered by permissions) ─────────────────────
function useNavigationSections() {
  const modules = useVisibleModules();
  return modules.map((mod) => ({
    to: mod.path,
    label: mod.label,
    icon: ICON_MAP[mod.icon] || Package,
    activeRoutes: getActiveRoutes(mod.key),
  }));
}

function getActiveRoutes(key) {
  const map = {
    dashboard: ["/", "/executive"],
    sales: ["/sales", "/crm"],
    inventory: ["/inventory", "/wms", "/manufacturing", "/eam", "/products"],
    purchase: ["/purchase", "/supplier-portal"],
    manufacturing: ["/manufacturing"],
    accounts: ["/accounts"],
    crm: ["/crm"],
    hrms: ["/hrms"],
    eam: ["/eam"],
    reports: ["/reports", "/executive"],
    audit: ["/activity"],
    settings: ["/settings"],
    admin: ["/admin"],
  };
  return map[key] || [];
}

const SETTINGS_ROUTES = ["/settings", "/company", "/branches", "/users", "/hrms", "/activity"];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const permissions = usePermissionStore((s) => s.permissions);
  const sections = useNavigationSections();

  // Sidebar state from shortcut store (persisted)
  const sidebarCollapsed = useShortcutStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useShortcutStore((s) => s.toggleSidebar);
  const setSidebarCollapsed = useShortcutStore((s) => s.setSidebarCollapsed);

  // Module detection
  useActiveModule(pathname);

  // Mobile sidebar drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Track mobile state
  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 1024);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Close mobile drawer on ESC
  useEffect(() => {
    if (!mobileDrawerOpen) return;
    function onKey(e) {
      if (e.key === "Escape") setMobileDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileDrawerOpen]);

  // Register as overlay for ESC stack
  useOverlayStack("sidebar-mobile", mobileDrawerOpen && isMobile);

  // Init permissions from JWT on first load
  useState(() => {
    const store = usePermissionStore.getState();
    if (!store.loaded) {
      try {
        const token = localStorage.getItem("velora_access_token");
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.permissions) store.setPermissions(payload.permissions);
        }
      } catch { /* ignore */ }
    }
  });

  async function logout() {
    try {
      const refreshToken = localStorage.getItem("velora_refresh_token");
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // silent
    }
    clearSession();
    navigate("/login");
  }

  function isSectionActive(section) {
    return section.activeRoutes.some((route) => {
      if (route === "/") return pathname === "/";
      return pathname.startsWith(route);
    });
  }

  const isSuperAdmin = permissions.includes("*");
  const canViewAdmin = isSuperAdmin || permissions.includes("admin:view");
  const canViewSettings = isSuperAdmin || permissions.includes("settings:view");

  // Mobile nav items (derived from sections, limited to 5)
  const mobileNav = sections.slice(0, 5).map((s) => ({
    to: s.to,
    label: s.label?.slice(0, 8) || "Home",
    icon: s.icon,
  }));

  // ─── Render sidebar content (shared between desktop and mobile) ─────
  const sidebarContent = (asDrawer = false) => (
    <div className={`flex h-full flex-col ${asDrawer ? "" : "p-5"}`}>
      {/* Brand - collapsed: icon only; expanded: full with name */}
      <div className={`flex items-center gap-3 ${!asDrawer && sidebarCollapsed ? "justify-center px-2" : ""}`}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
          <Building2 size={20} />
        </div>
        {(!sidebarCollapsed || asDrawer) && (
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-sm font-semibold text-slate-950">
              {user?.name || "Your Company"}
            </p>
            <p className="truncate text-xs text-slate-500">Velora ERP</p>
          </div>
        )}
      </div>

      {/* Toggle button - visible only on desktop */}
      {!asDrawer && (
        <button
          onClick={toggleSidebar}
          className="mt-4 flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title={sidebarCollapsed ? "Expand sidebar (Ctrl+Shift+S)" : "Collapse sidebar (Ctrl+Shift+S)"}
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      )}

      {/* Navigation */}
      <nav className={`mt-4 flex-1 space-y-1 overflow-y-auto ${asDrawer ? "" : sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
        {sections.map((section) => {
          const active = isSectionActive(section);
          return (
            <Link
              key={section.to}
              to={section.to}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              } ${!asDrawer && sidebarCollapsed ? "w-11 justify-center px-0" : ""}`}
              title={sidebarCollapsed && !asDrawer ? section.label : undefined}
            >
              <section.icon size={18} className="shrink-0" />
              {(!sidebarCollapsed || asDrawer) && (
                <span className="truncate">{section.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section - collapsed: minimize */}
      <div className={`mt-auto ${asDrawer ? "" : sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
        <div className={`border-t border-slate-200 py-4 ${
          !asDrawer && sidebarCollapsed && !canViewAdmin && !canViewSettings
            ? "border-t-0"
            : ""
        } space-y-1`}>
          {canViewAdmin && (
            <Link
              to="/admin"
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                pathname.startsWith("/admin")
                  ? "bg-purple-50 text-purple-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              } ${!asDrawer && sidebarCollapsed ? "w-11 justify-center px-0" : ""}`}
              title={sidebarCollapsed && !asDrawer ? "Administration" : undefined}
            >
              <Shield size={18} className="shrink-0" />
              {(!sidebarCollapsed || asDrawer) && <span>Administration</span>}
            </Link>
          )}

          {canViewSettings && (
            <Link
              to="/settings"
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                pathname.startsWith("/settings")
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              } ${!asDrawer && sidebarCollapsed ? "w-11 justify-center px-0" : ""}`}
              title={sidebarCollapsed && !asDrawer ? "Settings" : undefined}
            >
              <Settings size={18} className="shrink-0" />
              {(!sidebarCollapsed || asDrawer) && <span>Settings</span>}
            </Link>
          )}

          {/* User info - collapsed: hide full info, show just avatar */}
          {(!sidebarCollapsed || asDrawer) ? (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {user?.name?.charAt(0)?.toUpperCase() || "V"}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-slate-950">
                  {user?.name || "User"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {user?.email || ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-1">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700"
                   title={user?.name || "User"}>
                {user?.name?.charAt(0)?.toUpperCase() || "V"}
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={logout}
            className={`inline-flex w-full min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 ${
              !asDrawer && sidebarCollapsed ? "w-11 justify-center px-0" : ""
            }`}
            title={sidebarCollapsed && !asDrawer ? "Logout" : undefined}
          >
            <LogOut size={18} className="shrink-0" />
            {(!sidebarCollapsed || asDrawer) && <span>Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-dvh bg-slate-50 ${
        isMobile ? "" : "lg:grid transition-[grid-template-columns] duration-300 ease-in-out"
      }`}
      style={!isMobile ? { gridTemplateColumns: sidebarCollapsed ? "0px 1fr" : "272px 1fr" } : undefined}
    >
      {/* ─── Desktop Sidebar ────────────────────────────────── */}
      <aside
        className={`hidden border-r border-slate-200 bg-white transition-all duration-300 ease-in-out lg:block overflow-hidden ${
          sidebarCollapsed ? "w-0 opacity-0" : "w-[272px] opacity-100"
        }`}
      >
        <div className="sticky top-0 h-screen">
          {sidebarContent(false)}
        </div>
      </aside>

      {/* ─── Mobile Sidebar Drawer ──────────────────────────── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileDrawerOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute inset-y-0 left-0 z-50 w-[280px] animate-slide-in-left bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Navigation</p>
                    <p className="text-xs text-slate-500">Velora ERP</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {sidebarContent(true)}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ─── Main Content ───────────────────────────────────── */}
      <section className="min-w-0">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          {/* Hamburger for mobile drawer */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Building2 size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-950">
              {user?.name || "Your Company"}
            </p>
            <p className="text-xs text-slate-500">Velora ERP</p>
          </div>
          {canViewSettings && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `rounded-lg p-2 transition ${isActive ? "text-blue-700 bg-blue-50" : "text-slate-600 hover:bg-slate-50"}`
              }
            >
              <Settings size={18} />
            </NavLink>
          )}
          <button
            onClick={logout}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={17} />
          </button>
        </header>

        {/* Page content */}
        <main className="min-w-0 pb-24 lg:pb-24">
          <GlobalSearch />
          <Outlet />
          <AICopilot />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            {mobileNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-500"
                  }`
                }
              >
                <item.icon size={20} />
                <span className="max-w-full truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </section>
    </div>
  );
}
