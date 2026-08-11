import { useState, useCallback, useEffect } from "react";
import {
  Activity, BarChart3, Building2, LogOut, Package, Settings,
  ShoppingBag, ShoppingCart, Users, Warehouse, Shield, PanelLeftClose, PanelLeft, X, ChevronRight,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { authApi, onSessionExpired } from "../services/api";
import { usePermissionStore, useVisibleModules, initPermissions } from "../hooks/usePermissions";
import {
  useShortcutStore,
  useActiveModule,
  useOverlayStack,
} from "../hooks/useShortcutManager";
import GlobalSearch from "./GlobalSearch";
import AICopilot from "./AICopilot";

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
    reports: ["/executive"],
    audit: ["/activity"],
    settings: ["/settings"],
    admin: ["/admin"],
  };
  return map[key] || [];
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const permissions = usePermissionStore((s) => s.permissions);
  const sections = useNavigationSections();

  const sidebarCollapsed = useShortcutStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useShortcutStore((s) => s.toggleSidebar);

  useActiveModule(pathname);

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(() => {
    try { return JSON.parse(localStorage.getItem("velora_profile_expanded") ?? "true"); } catch { return true; }
  });

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 1024); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { setMobileDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    function onKey(e) { if (e.key === "Escape") setMobileDrawerOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileDrawerOpen]);

  useOverlayStack("sidebar-mobile", mobileDrawerOpen && isMobile);

  useEffect(() => {
    // Authoritative source is the backend. initPermissions() applies the JWT
    // claim immediately for an instant render, then overrides it with server
    // truth from /auth/me (with bounded retries). Every outcome leaves the
    // store `loaded`, so direct deep links (e.g. straight to /sales) never
    // deadlock on an unloaded permission state.
    initPermissions();
  }, []);

  // Register session expiration handler — redirects via React Router
  // instead of hard window.location.href navigation (which caused white screens)
  useEffect(() => {
    onSessionExpired(() => {
      clearSession();
      navigate("/login", { replace: true });
    });
  }, [navigate, clearSession]);

  async function logout() {
    try {
      const refreshToken = localStorage.getItem("velora_refresh_token");
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* silent */ }
    clearSession();
    navigate("/login");
  }

  function toggleProfile() {
    const next = !profileExpanded;
    setProfileExpanded(next);
    localStorage.setItem("velora_profile_expanded", JSON.stringify(next));
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

  const mobileNav = sections.slice(0, 5).map((s) => ({
    to: s.to,
    label: s.label?.slice(0, 8) || "Home",
    icon: s.icon,
  }));

  const sidebarContent = (asDrawer = false) => (
    <div className={`flex h-full flex-col ${asDrawer ? "" : "px-3 py-4"}`}>
      {/* Brand */}
      <div className={`flex items-center gap-3 ${!asDrawer && sidebarCollapsed ? "justify-center px-1" : "px-2"}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <Building2 size={18} />
        </div>
        {(!sidebarCollapsed || asDrawer) && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900">Velora ERP</p>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      {!asDrawer && (
        <button
          onClick={toggleSidebar}
          className="mt-3 flex w-full items-center justify-center rounded-lg py-1.5 text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-600"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      )}

      {/* Navigation — filter out admin/settings (rendered in bottom section) */}
      <nav className={`mt-3 flex-1 space-y-0.5 overflow-y-auto scrollbar-thin ${asDrawer ? "" : sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
        {sections.filter((s) => s.to !== "/admin" && s.to !== "/settings").map((section) => {
          const active = isSectionActive(section);
          return (
            <Link
              key={section.to}
              to={section.to}
              className={`group flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-all duration-150 ${
                active
                  ? "bg-blue-50 text-blue-700 shadow-sm shadow-blue-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              } ${!asDrawer && sidebarCollapsed ? "w-10 justify-center px-0" : ""}`}
              title={sidebarCollapsed && !asDrawer ? section.label : undefined}
            >
              <section.icon size={17} className={`shrink-0 transition-transform duration-150 ${active ? "" : "group-hover:scale-110"}`} />
              {(!sidebarCollapsed || asDrawer) && <span className="truncate">{section.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={`mt-auto ${asDrawer ? "" : sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
        <div className={`border-t border-slate-100 pt-2 space-y-0.5`}>
          {canViewAdmin && (
            <Link
              to="/admin"
              className={`flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-all duration-150 ${
                pathname.startsWith("/admin")
                  ? "bg-purple-50 text-purple-700 shadow-sm shadow-purple-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              } ${!asDrawer && sidebarCollapsed ? "w-10 justify-center px-0" : ""}`}
              title={sidebarCollapsed && !asDrawer ? "Administration" : undefined}
            >
              <Shield size={17} className="shrink-0" />
              {(!sidebarCollapsed || asDrawer) && <span>Administration</span>}
            </Link>
          )}
          {canViewSettings && (
            <Link
              to="/settings"
              className={`flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-all duration-150 ${
                pathname.startsWith("/settings")
                  ? "bg-blue-50 text-blue-700 shadow-sm shadow-blue-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              } ${!asDrawer && sidebarCollapsed ? "w-10 justify-center px-0" : ""}`}
              title={sidebarCollapsed && !asDrawer ? "Settings" : undefined}
            >
              <Settings size={17} className="shrink-0" />
              {(!sidebarCollapsed || asDrawer) && <span>Settings</span>}
            </Link>
          )}

          {/* User Profile — ChatGPT-style collapsible */}
          {(!sidebarCollapsed || asDrawer) ? (
            <div className="mt-2 rounded-lg border border-slate-100">
              <button
                onClick={toggleProfile}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-50 rounded-t-lg"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {user?.name?.charAt(0)?.toUpperCase() || "V"}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-[13px] font-medium text-slate-900">{user?.name || "User"}</p>
                </div>
                <ChevronRight size={14} className={`shrink-0 text-slate-400 transition-transform duration-200 ${profileExpanded ? "rotate-90" : ""}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-200 ease-in-out ${profileExpanded ? "max-h-24 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="border-t border-slate-100 px-3 pb-2 pt-1.5">
                  <p className="truncate text-xs text-slate-500">{user?.email || ""}</p>
                  <button
                    onClick={logout}
                    className="mt-1.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-red-600"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-2">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 cursor-pointer hover:bg-blue-200 transition-colors"
                title={user?.name || "User"}
                onClick={toggleProfile}
              >
                {user?.name?.charAt(0)?.toUpperCase() || "V"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-dvh bg-slate-50 ${
        isMobile ? "" : "lg:grid transition-[grid-template-columns] duration-300 ease-in-out"
      }`}
      style={!isMobile ? { gridTemplateColumns: sidebarCollapsed ? "0px 1fr" : "256px 1fr" } : undefined}
    >
      {/* Desktop Sidebar */}
      <aside
        className={`hidden border-r border-slate-200/80 bg-white transition-all duration-300 ease-in-out lg:block overflow-hidden ${
          sidebarCollapsed ? "w-0 opacity-0" : "w-[256px] opacity-100"
        }`}
      >
        <div className="sticky top-0 h-screen overflow-hidden">
          {sidebarContent(false)}
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 z-50 w-[280px] animate-slide-in-left bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
                    <Building2 size={18} />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-900">Velora ERP</p>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="rounded-lg p-2 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {sidebarContent(true)}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <section className="min-w-0">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors duration-150 hover:bg-slate-100"
          >
            <Building2 size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900">Velora ERP</p>
          </div>
          {canViewSettings && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `rounded-lg p-2 transition-colors duration-150 ${isActive ? "text-blue-700 bg-blue-50" : "text-slate-600 hover:bg-slate-100"}`
              }
            >
              <Settings size={18} />
            </NavLink>
          )}
          <button
            onClick={logout}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors duration-150 hover:bg-slate-50"
          >
            <LogOut size={17} />
          </button>
        </header>

        {/* Page content */}
        <main className="fab-safe-area min-w-0">
          <GlobalSearch />
          <Outlet />
          <AICopilot />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            {mobileNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-all duration-150 ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-500 active:bg-slate-100"
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
