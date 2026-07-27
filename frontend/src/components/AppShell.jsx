import { useState } from "react";
import {
  Activity, BarChart3, Building2, LogOut, Package, Settings,
  ShoppingBag, ShoppingCart, Users, Warehouse,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { authApi } from "../services/api";
import AICopilot from "./AICopilot";

// ─── 5 Primary Navigation Sections ──────────────────────────────────
const sections = [
  {
    to: "/",
    label: "Dashboard",
    icon: BarChart3,
    activeRoutes: ["/", "/executive"],
  },
  {
    to: "/sales",
    label: "Sales",
    icon: ShoppingCart,
    activeRoutes: ["/sales", "/crm"],
  },
  {
    to: "/inventory",
    label: "Inventory",
    icon: Warehouse,
    activeRoutes: ["/inventory", "/wms", "/manufacturing", "/eam", "/products"],
  },
  {
    to: "/purchase",
    label: "Procurement",
    icon: ShoppingBag,
    activeRoutes: ["/purchase", "/supplier-portal"],
  },
  {
    to: "/accounts",
    label: "Finance",
    icon: BarChart3,
    activeRoutes: ["/accounts"],
  },
];

// Mobile bottom nav shows the same 5 sections
const mobileNav = [
  { to: "/", label: "Home", icon: Package },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/purchase", label: "Buy", icon: ShoppingBag },
  { to: "/inventory", label: "Stock", icon: Warehouse },
  { to: "/accounts", label: "Money", icon: BarChart3 },
];

// Settings-related routes for active state in the profile bar
const SETTINGS_ROUTES = ["/settings", "/company", "/branches", "/users", "/hrms", "/activity"];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

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

  const isSettingsActive = SETTINGS_ROUTES.some((route) => {
    return pathname === route || pathname.startsWith(route + "/");
  });

  return (
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[272px_1fr]">
      {/* ─── Desktop Sidebar ────────────────────────────────── */}
      <aside className="hidden border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-5">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
              <Building2 size={20} />
            </div>
            <div>
              <p className="font-semibold text-slate-950">
                {user?.name || "Your Company"}
              </p>
              <p className="text-xs text-slate-500">Velora ERP</p>
            </div>
          </div>

          {/* Navigation — 5 sections only */}
          <nav className="mt-8 space-y-1">
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
                  }`}
                >
                  <section.icon size={18} />
                  {section.label}
                </Link>
              );
            })}
          </nav>

          {/* Profile bar at bottom */}
          <div className="mt-auto">
            <div className="border-t border-slate-200 pt-4 space-y-1">
              {/* Settings link */}
              <Link
                to="/settings"
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                  isSettingsActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <Settings size={18} />
                Settings
              </Link>

              {/* User info */}
              <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {user?.name?.charAt(0)?.toUpperCase() || "V"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-950">
                    {user?.name || "User"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user?.email || ""}
                  </p>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                className="inline-flex w-full min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ───────────────────────────────────── */}
      <section className="min-w-0">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
            <Building2 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-950">
              {user?.name || "Your Company"}
            </p>
            <p className="text-xs text-slate-500">Velora ERP</p>
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `rounded-lg p-2 transition ${isActive ? "text-blue-700 bg-blue-50" : "text-slate-600 hover:bg-slate-50"}`
            }
          >
            <Settings size={18} />
          </NavLink>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={17} />
          </button>
        </header>

        {/* Page content */}
        <main className="min-w-0 pb-24 lg:pb-0">
          <Outlet />
          <AICopilot />
        </main>

        {/* Mobile Bottom Nav — 5 sections */}
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
