import { cn } from "@/lib/utils";
import { AlertTriangle, Briefcase, Gauge, Lightbulb, Shield, Workflow, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { ThemeToggle } from "../ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useAISettingsStore } from "@/stores/aiSettingsStore";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Businesses", href: "/businesses", icon: Briefcase },
  { label: "Processes", href: "/processes", icon: Workflow },
  { label: "Pain Points", href: "/pain-points", icon: AlertTriangle },
  { label: "Solutions", href: "/use-cases", icon: Lightbulb },
  { label: "AI", href: "/ai", icon: Sparkles, requiresAi: true }
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ isMobileOpen = false, onNavigate }: SidebarProps) {
  const [location] = useLocation();
  const { isAdmin } = useAuth();
  const { aiEnabled } = useAISettingsStore();

  const isActive = (href: string) =>
    location === href ||
    location.startsWith(`${href}/`) ||
    (href === "/dashboard" && location === "/");

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 transition-all duration-300",
        "bg-card/80 backdrop-blur-xl border-r border-border",
        "overflow-y-auto",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AI_Pipeline Logo" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="text-xl font-bold gradient-text">
                AI_Pipeline
              </h1>
              <p className="text-xs text-muted-foreground">Process Intelligence</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const isAiItem = 'requiresAi' in item && item.requiresAi;

            if (isAiItem && !aiEnabled) {
              return null;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  active
                    ? "gradient-bg text-white shadow-lg shadow-purple-500/20"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                onClick={() => onNavigate?.()}
              >
                <Icon className={cn(
                  "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                  active ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span>{item.label}</span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />
                )}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 space-y-4">
          <Link
            href="/admin"
            className={cn(
              "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
              isActive("/admin")
                ? "gradient-bg text-white shadow-lg shadow-purple-500/20"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            onClick={() => onNavigate?.()}
          >
            <Shield className={cn(
              "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
              isActive("/admin") ? "text-white" : "text-muted-foreground group-hover:text-foreground"
            )} />
            <span>Admin</span>
            {isAdmin && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500 font-medium">
                Active
              </span>
            )}
          </Link>
          
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-medium text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          
          <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-4 border border-purple-500/10">
            <p className="text-xs font-medium text-foreground">Need help?</p>
            <p className="text-xs text-muted-foreground mt-1">Contact support</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
