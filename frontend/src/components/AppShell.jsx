import { Activity, BarChart3, Boxes, Building2, FileText, Home, Package, ShoppingCart } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/master", label: "Master Data", icon: Boxes },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/purchase", label: "Purchase", icon: FileText },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/accounts", label: "Accounts", icon: BarChart3 },
  { to: "/activity", label: "Activity", icon: Activity },
];

export function AppShell({ children }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
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
      <main className="min-w-0">{children}</main>
    </div>
  );
}
