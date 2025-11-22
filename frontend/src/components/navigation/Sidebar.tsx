import { cn } from "@/lib/utils";
import { AlertTriangle, Briefcase, Gauge, Lightbulb, Workflow } from "lucide-react";
import { Link, useLocation } from "wouter";

const navItems = [
  { label: "Businesses", href: "/businesses", icon: Briefcase },
  { label: "Processes", href: "/processes", icon: Workflow },
  { label: "Pain Points", href: "/pain-points", icon: AlertTriangle },
  { label: "Use Cases", href: "/use-cases", icon: Lightbulb },
  { label: "Dashboard", href: "/dashboard", icon: Gauge }
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
        "fixed inset-y-0 left-0 z-40 w-60 border-r bg-gray-100 transition-transform duration-200",
        "overflow-y-auto pt-6 px-4",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0"
      )}
    >
      <div className="flex flex-col gap-6">
        <div className="px-3 text-lg font-semibold text-gray-800">AIValue</div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors",
                  "hover:bg-gray-200",
                  active && "bg-blue-100 font-semibold text-blue-700"
                )}
                onClick={() => onNavigate?.()}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
