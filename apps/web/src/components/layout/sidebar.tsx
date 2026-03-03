"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Workflow,
  Bot,
  DollarSign,
  AlertTriangle,
  Bell,
  Shield,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: {
    count: number;
    variant: "default" | "warning" | "error";
  };
}

// In a real app, these would come from a store or API
const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Executions", href: "/executions", icon: Workflow },
  { name: "Agents", href: "/agents", icon: Bot },
  { name: "Costs", href: "/costs", icon: DollarSign },
  {
    name: "Incidents",
    href: "/incidents",
    icon: AlertTriangle,
    badge: { count: 2, variant: "error" },
  },
  {
    name: "Alerts",
    href: "/alerts",
    icon: Bell,
    badge: { count: 4, variant: "warning" },
  },
  { name: "Compliance", href: "/compliance", icon: Shield },
];

function NavBadge({
  count,
  variant,
}: {
  count: number;
  variant: "default" | "warning" | "error";
}) {
  if (count === 0) return null;

  const variantClasses = {
    default: "bg-muted text-muted-foreground",
    warning: "bg-amber-500/15 text-amber-500",
    error: "bg-red-500/15 text-red-500",
  };

  return (
    <span
      className={cn(
        "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums",
        variantClasses[variant]
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-60 flex-col bg-card/50 border-r border-border/50">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border/50 px-5">
        <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold tracking-tight">AgentOps</span>
        <span className="ml-auto text-[10px] font-medium text-amber-500 bg-amber-500/15 px-1.5 py-0.5 rounded">
          DEMO
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3">
        <div className="space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <NavBadge count={item.badge.count} variant={item.badge.variant} />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Status indicator */}
      <div className="mx-3 mb-3 rounded-md bg-muted/50 p-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            All systems operational
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 p-3 space-y-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
