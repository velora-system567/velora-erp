import { Activity, BarChart3, Boxes, Building2, FileText, Home, Package, ShoppingCart } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/master", label: "Master Data", icon: Boxes },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/purchase", label: "Purchase", icon: FileText },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/accounts", label: "Accounts", icon: BarChart3 },
  { to: "/activity", label: "Activity", icon: Activity },
];

export function AppShell() {
  return (
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
              <Building2 size={20} />
            </div>
            <div>
              <p className="font-semibold text-slate-950">Your Company</p>
              <p className="text-xs text-slate-500">Velora ERP</p>
            </div>
          </div>
          <nav className="mt-8 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">Fresh ERP</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Enter customer business data to begin operations.</p>
          </div>
        </div>
      </aside>
      <section className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
              <Building2 size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-950">Your Company</p>
              <p className="text-xs text-slate-500">Velora ERP</p>
            </div>
          </div>
        </header>
        <main className="min-w-0 pb-24 lg:pb-0">
        <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            {navItems.slice(0, 5).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-500"
                  }`
                }
              >
                <item.icon size={20} />
                <span className="max-w-full truncate">{item.label === "Master Data" ? "Master" : item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </section>
    </div>
  );
}
