import { cn } from "@/lib/utils";
import { AlertTriangle, Briefcase, Gauge, Lightbulb, Workflow } from "lucide-react";
import { Link, useLocation } from "wouter";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Businesses", href: "/businesses", icon: Briefcase },
  { label: "Processes", href: "/processes", icon: Workflow },
  { label: "Pain Points", href: "/pain-points", icon: AlertTriangle },
  { label: "Use Cases", href: "/use-cases", icon: Lightbulb }
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ isMobileOpen = false, onNavigate }: SidebarProps) {
  const [location] = useLocation();

  const isActive = (href: string) =>
    location === href ||
    location.startsWith(`${href}/`) ||
    (href === "/dashboard" && location === "/");

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-200 bg-white shadow-sm transition-transform duration-300",
        "overflow-y-auto",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AIValue
          </h1>
          <p className="text-xs text-gray-500 mt-1">Process Intelligence</p>
        </div>
        
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                )}
                onClick={() => onNavigate?.()}
              >
                <Icon className={cn("h-5 w-5", active ? "text-blue-600" : "text-gray-400")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="border-t border-gray-200 p-4">
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
            <p className="text-xs font-medium text-gray-700">Need help?</p>
            <p className="text-xs text-gray-600 mt-1">Contact support</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
