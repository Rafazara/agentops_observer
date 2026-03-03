"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Download, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface GhostUIProps {
  variant: "dashboard" | "executions" | "agents" | "costs" | "incidents" | "alerts";
  className?: string;
}

// ============================================================================
// GHOST DATA
// ============================================================================

const ghostExecutions = [
  { agent: "lead-qualifier-v2", status: "completed", duration: "2.3s", cost: "$0.0024", quality: 94 },
  { agent: "customer-support-bot", status: "completed", duration: "1.8s", cost: "$0.0018", quality: 87 },
  { agent: "data-enrichment-agent", status: "running", duration: "0.5s", cost: "$0.0003", quality: null },
];

const ghostAgents = [
  { name: "lead-qualifier-v2", executions: "1,247", success: "99.2%", cost: "$12.45" },
  { name: "customer-support-bot", executions: "892", success: "97.8%", cost: "$8.32" },
  { name: "data-enrichment-agent", executions: "456", success: "99.5%", cost: "$4.21" },
];

// ============================================================================
// OVERLAY COMPONENT
// ============================================================================

function GhostOverlay({ 
  title, 
  subtitle, 
  ctaText = "Get Started",
  ctaHref = "/onboarding",
  icon = <Download className="h-5 w-5" />,
}: { 
  title: string; 
  subtitle: string;
  ctaText?: string;
  ctaHref?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px]" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md text-center shadow-2xl">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {subtitle}
        </p>
        <Link href={ctaHref}>
          <Button className="mt-4 gap-2">
            {ctaText}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// GHOST CONTENT COMPONENTS
// ============================================================================

function GhostExecutionRow({ exec }: { exec: typeof ghostExecutions[0] }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50">
      <div className={cn(
        "h-2 w-2 rounded-full",
        exec.status === "completed" ? "bg-emerald-500" : 
        exec.status === "running" ? "bg-amber-500 animate-pulse" : "bg-red-500"
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-zinc-300">{exec.agent}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-zinc-500">{exec.duration}</span>
          <span className="text-[10px] text-zinc-600">•</span>
          <span className="text-[10px] text-zinc-500">{exec.cost}</span>
        </div>
      </div>
      {exec.quality && (
        <div className="text-xs text-zinc-400">{exec.quality}/100</div>
      )}
    </div>
  );
}

function GhostDashboard() {
  return (
    <div className="space-y-4 opacity-60">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {["Active Agents", "Executions (24h)", "Success Rate", "Total Cost"].map((label, i) => (
          <div key={label} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-semibold mt-1 text-zinc-400">
              {i === 0 ? "4" : i === 1 ? "1,247" : i === 2 ? "99.2%" : "$47.89"}
            </p>
          </div>
        ))}
      </div>
      
      {/* Execution Feed */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-400">Live Execution Feed</h3>
        </div>
        {ghostExecutions.map((exec, i) => (
          <GhostExecutionRow key={i} exec={exec} />
        ))}
      </div>
    </div>
  );
}

function GhostExecutions() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg opacity-60">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">All Executions</h3>
        <div className="h-6 w-24 bg-zinc-800 rounded" />
      </div>
      {ghostExecutions.concat(ghostExecutions).map((exec, i) => (
        <GhostExecutionRow key={i} exec={exec} />
      ))}
    </div>
  );
}

function GhostAgentsList() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg opacity-60">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-400">Your Agents</h3>
      </div>
      {ghostAgents.map((agent, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center">
              <Zap className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-300">{agent.name}</p>
              <p className="text-[10px] text-zinc-500">{agent.executions} executions</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-zinc-400">{agent.success}</p>
            <p className="text-[10px] text-zinc-500">{agent.cost}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function GhostUI({ variant, className }: GhostUIProps) {
  const configs = {
    dashboard: {
      ghost: <GhostDashboard />,
      title: "Connect Your First Agent",
      subtitle: "Install the SDK and add the @trace decorator to see your dashboard come alive with real-time data.",
      icon: <Zap className="h-5 w-5 text-primary" />,
    },
    executions: {
      ghost: <GhostExecutions />,
      title: "Install SDK to See Executions",
      subtitle: "Once you instrument your agents, every execution will appear here in real-time.",
      icon: <Zap className="h-5 w-5 text-primary" />,
    },
    agents: {
      ghost: <GhostAgentsList />,
      title: "No Agents Detected Yet",
      subtitle: "Agents are auto-discovered when you run instrumented code. Install the SDK to get started.",
      icon: <Download className="h-5 w-5 text-primary" />,
    },
    costs: {
      ghost: <GhostDashboard />,
      title: "Track Your AI Costs",
      subtitle: "See exactly how much each agent costs per execution. Install the SDK to start tracking.",
      icon: <Download className="h-5 w-5 text-primary" />,
    },
    incidents: {
      ghost: (
        <div className="text-center py-12 opacity-60">
          <p className="text-lg font-medium text-zinc-400">No incidents detected</p>
          <p className="text-sm text-zinc-500 mt-1">Your agents are running smoothly!</p>
        </div>
      ),
      title: "Incident Detection Ready",
      subtitle: "We'll automatically detect loops, failures, and anomalies once your agents are running.",
      icon: <Zap className="h-5 w-5 text-primary" />,
    },
    alerts: {
      ghost: (
        <div className="text-center py-12 opacity-60">
          <p className="text-lg font-medium text-zinc-400">No alerts configured</p>
          <p className="text-sm text-zinc-500 mt-1">Create alert rules to get notified</p>
        </div>
      ),
      title: "Set Up Your First Alert",
      subtitle: "Get notified via Slack, email, or webhook when something goes wrong with your agents.",
      ctaText: "Create Alert",
      ctaHref: "/alerts/new",
      icon: <Zap className="h-5 w-5 text-primary" />,
    },
  };

  const config = configs[variant];

  return (
    <div className={cn("relative min-h-[400px]", className)}>
      {config.ghost}
      <GhostOverlay 
        title={config.title}
        subtitle={config.subtitle}
        ctaText={(config as { ctaText?: string }).ctaText}
        ctaHref={(config as { ctaHref?: string }).ctaHref}
        icon={config.icon}
      />
    </div>
  );
}
