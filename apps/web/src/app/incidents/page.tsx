"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageTitle } from "@/components/layout/page-title";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountUpNumber } from "@/components/ui/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Timer,
  Eye,
  RotateCcw,
  TrendingDown,
  DollarSign,
  Activity,
  Zap,
  Bell,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useIncidents, useIncidentStats, useAcknowledgeIncident, useResolveIncident, useAgents } from "@/lib/hooks";
import type { Incident as ApiIncident, IncidentStatus as ApiIncidentStatus, IncidentSeverity, Agent } from "@/lib/types";

// ============================================================================
// TYPES  
// ============================================================================

type IncidentType = "loop" | "cost_spike" | "quality_drop" | "error_rate" | "latency" | "rate_limit";

// Map API severity to display severity (local uses 'warning' instead of 'medium')
type Severity = "critical" | "high" | "warning" | "low";
type DisplayStatus = "open" | "acknowledged" | "resolved";

// Display-friendly incident type (what IncidentCard expects)
interface Incident {
  id: string;
  type: IncidentType;
  severity: Severity;
  status: DisplayStatus;
  title: string;
  affected_agent: string;
  project: string;
  created_at: string;
  agent_id?: string;
}

function mapSeverity(apiSeverity: IncidentSeverity): Severity {
  if (apiSeverity === "medium") return "warning";
  return apiSeverity;
}

// Map incident_type to our known types
function mapIncidentType(apiType: string): IncidentType {
  const typeMap: Record<string, IncidentType> = {
    "infinite_loop": "loop",
    "loop": "loop",
    "cost_spike": "cost_spike",
    "cost_anomaly": "cost_spike",
    "quality_drop": "quality_drop",
    "quality_degradation": "quality_drop",
    "error_rate": "error_rate",
    "high_error_rate": "error_rate",
    "latency": "latency",
    "latency_spike": "latency",
    "rate_limit": "rate_limit",
  };
  return typeMap[apiType] || "error_rate";
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const INCIDENT_TYPE_CONFIG: Record<IncidentType, { icon: React.ElementType; emoji: string; label: string }> = {
  loop: { icon: RotateCcw, emoji: "🔄", label: "Loop Detected" },
  cost_spike: { icon: DollarSign, emoji: "💸", label: "Cost Spike" },
  quality_drop: { icon: TrendingDown, emoji: "📉", label: "Quality Drop" },
  error_rate: { icon: AlertTriangle, emoji: "⚠️", label: "Error Rate" },
  latency: { icon: Activity, emoji: "🐌", label: "Latency Spike" },
  rate_limit: { icon: Zap, emoji: "⚡", label: "Rate Limit" },
};

const SEVERITY_CONFIG: Record<Severity, { color: string; bgColor: string; borderColor: string; label: string }> = {
  critical: { 
    color: "text-[hsl(var(--error))]", 
    bgColor: "bg-[hsl(var(--error))]/20", 
    borderColor: "border-[hsl(var(--error))]",
    label: "CRITICAL" 
  },
  high: { 
    color: "text-[hsl(var(--warning))]", 
    bgColor: "bg-[hsl(var(--warning))]/20", 
    borderColor: "border-[hsl(var(--warning))]",
    label: "HIGH" 
  },
  warning: { 
    color: "text-[hsl(var(--chart-2))]", 
    bgColor: "bg-[hsl(var(--chart-2))]/20", 
    borderColor: "border-[hsl(var(--chart-2))]",
    label: "WARNING" 
  },
  low: { 
    color: "text-[hsl(var(--info))]", 
    bgColor: "bg-[hsl(var(--info))]/20", 
    borderColor: "border-[hsl(var(--info))]",
    label: "LOW" 
  },
};

function SeverityBadge({ severity, pulse = false }: { severity: Severity; pulse?: boolean }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
        config.bgColor,
        config.color,
        pulse && "animate-pulse"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", severity === "critical" ? "bg-[hsl(var(--error))]" : severity === "high" ? "bg-[hsl(var(--warning))]" : severity === "warning" ? "bg-[hsl(var(--chart-2))]" : "bg-[hsl(var(--info))]")} />
      {config.label}
    </span>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

interface IncidentCardProps {
  incident: Incident;
  index: number;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
}

function IncidentCard({ incident, index, onAcknowledge, onResolve }: IncidentCardProps) {
  const router = useRouter();
  const typeConfig = INCIDENT_TYPE_CONFIG[incident.type];
  const severityConfig = SEVERITY_CONFIG[incident.severity];
  const isUnacknowledged = incident.status === "open";
  const isCritical = incident.severity === "critical";

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200 animate-fade-in-up cursor-pointer",
        `stagger-${Math.min(index + 1, 6)}`,
        // Left border based on severity
        "border-l-4",
        severityConfig.borderColor,
        // Critical incidents get red background tint
        isCritical && incident.status !== "resolved" && "bg-[hsl(var(--error))]/[0.03]",
        // Hover effect
        "hover:bg-[hsl(var(--bg-hover))] hover:border-[hsl(var(--border-default))]"
      )}
      onClick={() => router.push(`/incidents/${incident.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left section */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Type icon */}
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg",
              incident.status === "resolved" ? "bg-[hsl(var(--bg-hover))]" : severityConfig.bgColor
            )}>
              {typeConfig.emoji}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <SeverityBadge severity={incident.severity} pulse={isUnacknowledged} />
                {incident.status === "acknowledged" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]">
                    <Clock className="w-3 h-3" />
                    ACK
                  </span>
                )}
                {incident.status === "resolved" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]">
                    <CheckCircle2 className="w-3 h-3" />
                    RESOLVED
                  </span>
                )}
              </div>
              
              <h3 className={cn(
                "text-sm font-semibold mb-1 truncate",
                incident.status === "resolved" ? "text-[hsl(var(--text-muted))]" : "text-[hsl(var(--text-primary))]"
              )}>
                {incident.title}
              </h3>
              
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-muted))]">
                <span className="font-medium text-[hsl(var(--text-secondary))]">{incident.affected_agent}</span>
                <span>•</span>
                <span>{incident.project}</span>
                <span>•</span>
                <span>Detected {formatTimeAgo(incident.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {incident.status === "open" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 bg-[hsl(var(--bg-hover))] border-[hsl(var(--border-default))] hover:bg-[hsl(var(--warning))]/20 hover:border-[hsl(var(--warning))] hover:text-[hsl(var(--warning))]"
                  onClick={() => onAcknowledge?.(incident.id)}
                >
                  <Bell className="w-3.5 h-3.5" />
                  Acknowledge
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--bg-base))]"
                  onClick={() => onResolve?.(incident.id)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Resolve
                </Button>
              </>
            )}
            {incident.status === "acknowledged" && (
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--bg-base))]"
                onClick={() => onResolve?.(incident.id)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolve
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => router.push(`/incidents/${incident.id}`)}
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AllClearState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-24 h-24 rounded-full bg-[hsl(var(--success))]/20 flex items-center justify-center mb-6">
        <ShieldCheck className="w-12 h-12 text-[hsl(var(--success))]" />
      </div>
      <h3 className="text-xl font-semibold text-[hsl(var(--text-primary))] mb-2">All Systems Operational</h3>
      <p className="text-sm text-[hsl(var(--text-muted))] text-center max-w-md">
        No active incidents detected. Your agents are running smoothly.
      </p>
      <div className="flex items-center gap-2 mt-6">
        <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))] animate-pulse" />
        <span className="text-sm text-[hsl(var(--success))] font-medium">Monitoring active</span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function IncidentsPage() {
  const [statusFilter, setStatusFilter] = useState<ApiIncidentStatus | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  
  // Fetch incidents and stats from API
  const { 
    data: incidents, 
    isLoading, 
    isError, 
    error, 
    refetch, 
    isFetching 
  } = useIncidents(statusFilter ? { status: statusFilter } : undefined);
  
  const { data: stats } = useIncidentStats();
  const { data: agents } = useAgents();
  
  // Mutations
  const acknowledgeIncident = useAcknowledgeIncident();
  const resolveIncident = useResolveIncident();

  // Map agent IDs to names
  const agentNameMap = useMemo(() => {
    if (!agents) return {};
    return agents.reduce((acc: Record<string, string>, agent: Agent) => {
      acc[agent.agent_id] = agent.name;
      return acc;
    }, {} as Record<string, string>);
  }, [agents]);

  // Filter incidents by status and transform to display format
  const filteredIncidents: Incident[] = useMemo(() => {
    if (!incidents) return [];
    return incidents.map((i): Incident => ({
      id: i.id,
      type: mapIncidentType(i.incident_type),
      severity: mapSeverity(i.severity),
      status: i.status as DisplayStatus,
      title: i.title,
      affected_agent: agentNameMap[i.agent_id || ""] || i.agent_id || "Unknown Agent",
      project: "AgentOps", // API doesn't have project field
      created_at: i.detected_at || i.created_at,
      agent_id: i.agent_id,
    }));
  }, [incidents, agentNameMap]);

  // Separate active vs resolved
  const activeIncidents = filteredIncidents.filter(i => i.status !== "resolved");
  const resolvedIncidents = filteredIncidents.filter(i => i.status === "resolved");

  // Calculate stats from data if API stats not available
  const displayStats = useMemo(() => {
    if (stats) return stats;
    return {
      open_count: filteredIncidents.filter(i => i.status === "open").length,
      acknowledged_count: filteredIncidents.filter(i => i.status === "acknowledged").length,
      resolved_count: filteredIncidents.filter(i => i.status === "resolved").length,
      total: filteredIncidents.length,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      avg_acknowledge_seconds: 510,
      avg_resolve_seconds: 2538,
    };
  }, [stats, filteredIncidents]);

  // Status filters dynamically computed
  const statusFilters: { key: "all" | ApiIncidentStatus; label: string; count: number }[] = [
    { key: "all", label: "All Incidents", count: filteredIncidents.length },
    { key: "open", label: "Open", count: displayStats.open_count },
    { key: "acknowledged", label: "Acknowledged", count: displayStats.acknowledged_count },
    { key: "resolved", label: "Resolved", count: displayStats.resolved_count },
  ];

  // Handler functions for mutations
  const handleAcknowledge = (id: string) => {
    acknowledgeIncident.mutate(id);
    toast({
      type: "success",
      title: "Incident acknowledged",
      description: "You've taken ownership of this incident.",
    });
  };

  const handleResolve = (id: string) => {
    resolveIncident.mutate({ id });
    toast({
      type: "success",
      title: "Incident resolved",
      description: "Great work! This incident has been marked as resolved.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[hsl(var(--bg-base))]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-9 w-36" />
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-10 w-96" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen bg-[hsl(var(--bg-base))]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Card className="border-[hsl(var(--error))]/50 bg-[hsl(var(--error-subtle))]">
              <CardContent className="p-6 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-[hsl(var(--error))]" />
                <div>
                  <p className="font-medium text-[hsl(var(--error))]">Failed to load incidents</p>
                  <p className="text-sm text-[hsl(var(--text-muted))]">{error?.message || "An error occurred"}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
                  Retry
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[hsl(var(--bg-base))]">
      <PageTitle title="Incidents" badge={displayStats.open_count} badgeType="critical" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-5 animate-fade-in">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
                  Incidents
                  {displayStats.open_count > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[hsl(var(--error))]/20 text-[hsl(var(--error))] animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-[hsl(var(--error))]" />
                      {displayStats.open_count} Active
                    </span>
                  )}
                </h1>
                <p className="text-sm text-[hsl(var(--text-muted))] mt-0.5">
                  Track and resolve issues affecting your AI agents
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                  Refresh
                </Button>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Incident
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid gap-3 md:grid-cols-5">
              <Card className={cn(
                "metric-card animate-fade-in-up stagger-1",
                displayStats.open_count > 0 && "border-[hsl(var(--error))]/50 bg-[hsl(var(--error))]/[0.03]"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                        Open
                      </span>
                      <div className={cn(
                        "text-3xl font-bold tabular-nums",
                        displayStats.open_count > 0 ? "text-[hsl(var(--error))]" : "text-[hsl(var(--text-muted))]"
                      )}>
                        <CountUpNumber value={displayStats.open_count} />
                      </div>
                    </div>
                    <AlertTriangle className={cn(
                      "w-8 h-8",
                      displayStats.open_count > 0 ? "text-[hsl(var(--error))]/50" : "text-[hsl(var(--border-default))]"
                    )} />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="metric-card animate-fade-in-up stagger-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                        Acknowledged
                      </span>
                      <div className="text-3xl font-bold tabular-nums text-[hsl(var(--warning))]">
                        <CountUpNumber value={displayStats.acknowledged_count} />
                      </div>
                    </div>
                    <Clock className="w-8 h-8 text-[hsl(var(--warning))]/50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="metric-card animate-fade-in-up stagger-3">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                        Resolved
                      </span>
                      <div className="text-3xl font-bold tabular-nums text-[hsl(var(--success))]">
                        <CountUpNumber value={displayStats.resolved_count} />
                      </div>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-[hsl(var(--success))]/50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="metric-card animate-fade-in-up stagger-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Timer className="h-3.5 w-3.5 text-[hsl(var(--text-disabled))]" />
                    <span className="text-xs font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                      MTTA
                    </span>
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-[hsl(var(--text-primary))]">
                    {Math.round((displayStats.avg_acknowledge_seconds || 0) / 60)}m
                  </div>
                  <p className="text-[10px] text-[hsl(var(--text-disabled))] mt-0.5">
                    Mean time to acknowledge
                  </p>
                </CardContent>
              </Card>
              
              <Card className="metric-card animate-fade-in-up stagger-5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Timer className="h-3.5 w-3.5 text-[hsl(var(--text-disabled))]" />
                    <span className="text-xs font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                      MTTR
                    </span>
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-[hsl(var(--text-primary))]">
                    {Math.round((displayStats.avg_resolve_seconds || 0) / 60)}m
                  </div>
                  <p className="text-[10px] text-[hsl(var(--text-disabled))] mt-0.5">
                    Mean time to resolve
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))]/50 p-1 w-fit">
              {statusFilters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() =>
                    setStatusFilter(filter.key === "all" ? null : filter.key as ApiIncidentStatus)
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
                    (filter.key === "all" && !statusFilter) ||
                      statusFilter === filter.key
                      ? "bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-primary))] shadow-sm"
                      : "text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))]"
                  )}
                >
                  {filter.label}
                  <span className={cn(
                    "text-xs tabular-nums px-1.5 py-0.5 rounded",
                    (filter.key === "all" && !statusFilter) ||
                      statusFilter === filter.key
                      ? "bg-[hsl(var(--bg-hover))] text-[hsl(var(--text-secondary))]"
                      : "bg-[hsl(var(--bg-hover))] text-[hsl(var(--text-muted))]"
                  )}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Incidents list */}
            {filteredIncidents.length === 0 || (statusFilter !== "resolved" && activeIncidents.length === 0 && !statusFilter) ? (
              <AllClearState />
            ) : (
              <div className="space-y-6">
                {/* Active incidents */}
                {activeIncidents.length > 0 && (
                  <div className="space-y-3">
                    {activeIncidents.map((incident, index) => (
                      <IncidentCard 
                        key={incident.id} 
                        incident={incident} 
                        index={index}
                        onAcknowledge={handleAcknowledge}
                        onResolve={handleResolve}
                      />
                    ))}
                  </div>
                )}

                {/* Resolved incidents */}
                {resolvedIncidents.length > 0 && statusFilter !== "open" && statusFilter !== "acknowledged" && (
                  <div className="space-y-3">
                    {activeIncidents.length > 0 && (
                      <div className="flex items-center gap-3 py-2">
                        <div className="h-px flex-1 bg-[hsl(var(--border-default))]" />
                        <span className="text-xs text-[hsl(var(--text-disabled))] font-medium uppercase tracking-wider">
                          Resolved
                        </span>
                        <div className="h-px flex-1 bg-[hsl(var(--border-default))]" />
                      </div>
                    )}
                    {resolvedIncidents.map((incident, index) => (
                      <IncidentCard 
                        key={incident.id} 
                        incident={incident} 
                        index={activeIncidents.length + index}
                        onAcknowledge={handleAcknowledge}
                        onResolve={handleResolve}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
