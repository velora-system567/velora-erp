import {
  Activity, BarChart3, Building2, FileText, Home, LogOut,
  MapPin, Package, ShoppingCart, Users, Cpu, ShoppingBag,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { authApi } from "../services/api";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/company", label: "Company", icon: Building2 },
  { to: "/branches", label: "Branches", icon: MapPin },
  { to: "/users", label: "Users", icon: Users },
  { to: "/products", label: "Products", icon: Package },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/purchase", label: "Purchase", icon: ShoppingBag },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/inventory/products", label: "  Products", icon: Package },
  { to: "/inventory/reports", label: "  Reports", icon: FileText },
  { to: "/inventory/suppliers", label: "  Suppliers", icon: Building2 },
  { to: "/accounts", label: "Accounts", icon: BarChart3 },
  { to: "/manufacturing", label: "Manufacturing", icon: Cpu },
  { to: "/activity", label: "Audit Log", icon: Activity },
];

// Bottom nav shows 5 most-used routes on mobile
const mobileNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/purchase", label: "Purchase", icon: ShoppingBag },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/accounts", label: "Accounts", icon: BarChart3 },
];

export function AppShell() {
  const navigate = useNavigate();
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

  return (
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[272px_1fr]">
      {/* Desktop Sidebar */}
      <aside className="hidden border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-5">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
              <Building2 size={20} />
            </div>
            <div>
              <p className="font-semibold text-slate-950">{user?.name || "Your Company"}</p>
              <p className="text-xs text-slate-500">{user?.email || "Velora ERP"}</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="mt-8 space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`
                }
              >
                <item.icon size={17} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="mt-auto">
            <button
              onClick={logout}
              className="inline-flex w-full min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <section className="min-w-0">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
              <Building2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{user?.name || "Your Company"}</p>
              <p className="text-xs text-slate-500">Velora ERP</p>
            </div>
            <button
              onClick={logout}
              className="ml-auto rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="min-w-0 pb-24 lg:pb-0">
          <Outlet />
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
