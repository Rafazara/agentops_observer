"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  Activity,
  Radio,
  ChevronLeft,
  ChevronRight,
  User,
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

interface NavSection {
  label: string;
  items: NavItem[];
}

// Navigation structure grouped by sections
const navigationSections: NavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "OBSERVABILITY",
    items: [
      { name: "Executions", href: "/executions", icon: Workflow },
      { name: "Live Feed", href: "/live-feed", icon: Radio },
    ],
  },
  {
    label: "ANALYTICS",
    items: [
      { name: "Agents", href: "/agents", icon: Bot },
      { name: "Performance", href: "/performance", icon: Activity },
      { name: "Costs", href: "/costs", icon: DollarSign },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
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
    ],
  },
  {
    label: "COMPLIANCE",
    items: [
      { name: "Policies", href: "/compliance", icon: Shield },
    ],
  },
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
    default: "bg-[hsl(var(--bg-hover))] text-[hsl(var(--text-muted))]",
    warning: "bg-[hsl(var(--warning-subtle))] text-[hsl(var(--warning))]",
    error: "bg-[hsl(var(--error-subtle))] text-[hsl(var(--error))]",
  };

  return (
    <span
      className={cn(
        "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
        variantClasses[variant]
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// AgentOps Logo Component
function AgentOpsLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Hexagon with network nodes */}
      <div className="relative flex h-8 w-8 items-center justify-center">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          className="h-8 w-8"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Hexagon background */}
          <path
            d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
            fill="hsl(var(--primary))"
            className="drop-shadow-sm"
          />
          {/* Network nodes */}
          <circle cx="16" cy="11" r="2.5" fill="white" />
          <circle cx="11" cy="19" r="2" fill="white" opacity="0.9" />
          <circle cx="21" cy="19" r="2" fill="white" opacity="0.9" />
          {/* Connection lines */}
          <path
            d="M16 13.5L11 17M16 13.5L21 17M11 19L21 19"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold tracking-tight text-[hsl(var(--text-primary))]">
              AgentOps
            </span>
            <span className="text-sm font-normal text-[hsl(var(--text-muted))]">
              Observer
            </span>
          </div>
          <span className="text-[9px] font-medium uppercase tracking-wider text-[hsl(var(--text-disabled))]">
            AI Fleet Intelligence
          </span>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-r transition-all duration-200",
        collapsed ? "w-16" : "w-60",
        "bg-[hsl(var(--bg-surface))]",
        "border-[hsl(var(--border-default))]"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 items-center border-b",
          collapsed ? "justify-center px-2" : "px-4",
          "border-[hsl(var(--border-default))]"
        )}
      >
        <AgentOpsLogo collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigationSections.map((section) => (
          <div key={section.label} className="mb-4">
            {/* Section label */}
            {!collapsed && (
              <div className="section-label">{section.label}</div>
            )}

            {/* Section items */}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                      collapsed
                        ? "justify-center px-2 py-2"
                        : "px-3 py-2",
                      isActive
                        ? cn(
                            "bg-[hsl(var(--bg-selected))] text-[hsl(var(--primary))]",
                            !collapsed && "border-l-2 border-[hsl(var(--primary))] -ml-[2px] pl-[calc(0.75rem+2px)]"
                          )
                        : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))]"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-[hsl(var(--primary))]"
                          : "text-[hsl(var(--text-muted))] group-hover:text-[hsl(var(--text-primary))]"
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.name}</span>
                        {item.badge && (
                          <NavBadge
                            count={item.badge.count}
                            variant={item.badge.variant}
                          />
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System status */}
      <div
        className={cn(
          "mx-3 mb-3 rounded-lg p-3",
          "bg-[hsl(var(--bg-hover))]"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {!collapsed && (
            <span className="text-xs font-medium text-[hsl(var(--text-muted))]">
              All systems operational
            </span>
          )}
        </div>
      </div>

      {/* Footer - Settings & User */}
      <div
        className={cn(
          "border-t p-3",
          "border-[hsl(var(--border-default))]"
        )}
      >
        {/* Settings */}
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "group mb-2 flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150",
            collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
            pathname === "/settings"
              ? "bg-[hsl(var(--bg-selected))] text-[hsl(var(--primary))]"
              : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))]"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>

        {/* User profile & logout */}
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg p-2",
            "bg-[hsl(var(--bg-base))]"
          )}
        >
          {/* Avatar */}
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              "bg-[hsl(var(--primary))]"
            )}
          >
            <User className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium text-[hsl(var(--text-primary))]">
                  Demo User
                </div>
                <div className="truncate text-xs text-[hsl(var(--text-muted))]">
                  demo@agentops.ai
                </div>
              </div>
              <button
                className="rounded-md p-1.5 text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--bg-hover))] hover:text-[hsl(var(--text-primary))] transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200",
          "bg-[hsl(var(--bg-elevated))] border border-[hsl(var(--border-default))]",
          "text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]",
          "hover:border-[hsl(var(--border-strong))]",
          "shadow-md"
        )}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
