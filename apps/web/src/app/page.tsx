"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  Zap,
  CircleDot,
  RefreshCw,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageTitle } from "@/components/layout/page-title";
import { CountUpNumber, CountUpCurrency } from "@/components/ui/count-up";
import { StatusBadge, SeverityBadge } from "@/components/ui/status-badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { QualityScore } from "@/components/ui/circular-progress";
import { cn } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { useExecutionStats, useExecutions, useAgents, useCostsSummary, useIncidents, useIncidentStats } from "@/lib/hooks";
import { useRealtimeUpdates, ConnectionStatus } from "@/lib/websocket";
import { useToast } from "@/components/ui/use-toast";

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function HealthDot({ health }: { health: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-emerald-500",
    degraded: "bg-amber-500",
    critical: "bg-red-500",
  };
  
  return (
    <span className="relative flex h-2.5 w-2.5">
      {health !== "healthy" && (
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", colors[health])} />
      )}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", colors[health])} />
    </span>
  );
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // API Queries
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useExecutionStats("24h");
  const { data: executionsData, isLoading: executionsLoading } = useExecutions({ limit: 10 });
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: costs, isLoading: costsLoading } = useCostsSummary("30d");
  const { data: incidents, isLoading: incidentsLoading } = useIncidents({ limit: 5 });
  const { data: incidentStats } = useIncidentStats("30d");
  
  // WebSocket real-time updates
  const { status: wsStatus } = useRealtimeUpdates({
    enabled: isAuthenticated,
    onExecutionUpdate: () => {
      refetchStats();
    },
    onIncidentCreated: (event) => {
      toast({
        type: event.severity === "critical" ? "error" : "warning",
        title: "New Incident",
        description: event.title,
      });
    },
  });
  
  // Derived data
  const executions = executionsData?.data || [];
  const isLoading = authLoading || statsLoading || executionsLoading || agentsLoading;
  
  // Compute metrics
  const metrics = useMemo(() => {
    return {
      active_agents: agents?.filter(a => a.is_active).length || 0,
      running_now: stats?.running_executions || 0,
      executions_today: stats?.total_executions || 0,
      success_rate: stats?.success_rate || 0,
      executions_yesterday: Math.floor((stats?.total_executions || 0) * 0.9),
      cost_today: stats?.total_cost_usd || 0,
      cost_month: costs?.total_cost || 0,
      budget_month: 5000,
      open_incidents: incidentStats?.open_count || 0,
      critical_incidents: incidentStats?.critical_count || 0,
      warning_incidents: (incidentStats?.high_count || 0) + (incidentStats?.medium_count || 0),
    };
  }, [stats, agents, costs, incidentStats]);
  
  const executionChange = useMemo(() => {
    if (metrics.executions_yesterday === 0) return { value: "0.0", positive: true };
    const change = ((metrics.executions_today - metrics.executions_yesterday) / metrics.executions_yesterday) * 100;
    return { value: Math.abs(change).toFixed(1), positive: change >= 0 };
  }, [metrics]);
  
  const budgetPercentage = (metrics.cost_month / metrics.budget_month) * 100;
  const budgetStatus = budgetPercentage >= 90 ? "critical" : budgetPercentage >= 75 ? "warning" : "ok";
  
  // Cost by agent for pie chart
  const costByAgent = useMemo(() => {
    if (!costs?.by_agent) return [];
    const colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
    return costs.by_agent.slice(0, 5).map((a, i) => ({
      name: a.agent_id,
      value: a.cost,
      color: colors[i % colors.length],
    }));
  }, [costs]);

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <DashboardSkeleton />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <PageTitle title="Dashboard" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-5">
          <div className="space-y-5 animate-fade-in">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Mission Control</h1>
                <p className="text-xs text-muted-foreground">
                  Real-time overview of your AI agent fleet
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ConnectionStatus status={wsStatus} />
                <button
                  onClick={() => refetchStats()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            </div>
            
            {/* KPI Cards Row */}
            <div className="grid grid-cols-4 gap-4" data-tour="kpi-cards">
              {/* Active Agents */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active Agents</p>
                      <p className="text-2xl font-semibold mt-1">
                        <CountUpNumber value={metrics.active_agents} />
                      </p>
                      <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-1">
                        <CircleDot className="h-3 w-3 animate-pulse" />
                        {metrics.running_now} running now
                      </p>
                    </div>
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Bot className="h-4.5 w-4.5 text-emerald-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Executions Today */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Executions (24h)</p>
                      <p className="text-2xl font-semibold mt-1">
                        <CountUpNumber value={metrics.executions_today} />
                      </p>
                      <p className={cn("text-xs mt-0.5 flex items-center gap-1", executionChange.positive ? "text-emerald-500" : "text-red-500")}>
                        {executionChange.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {executionChange.value}% vs yesterday
                      </p>
                    </div>
                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Activity className="h-4.5 w-4.5 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Success Rate */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Success Rate</p>
                      <p className="text-2xl font-semibold mt-1">
                        <CountUpNumber value={metrics.success_rate} suffix="%" />
                      </p>
                      <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {metrics.success_rate >= 90 ? "Above target" : "Below target"} (90%)
                      </p>
                    </div>
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Open Incidents */}
              <Card className={cn(
                "bg-zinc-900/50 border-zinc-800",
                metrics.critical_incidents > 0 && "border-red-500/50 bg-red-500/5"
              )}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Open Incidents</p>
                      <p className="text-2xl font-semibold mt-1">
                        <CountUpNumber value={metrics.open_incidents} />
                      </p>
                      <p className={cn(
                        "text-xs mt-0.5 flex items-center gap-1",
                        metrics.critical_incidents > 0 ? "text-red-500" : "text-amber-500"
                      )}>
                        {metrics.critical_incidents > 0 ? (
                          <>
                            <AlertTriangle className="h-3 w-3" />
                            {metrics.critical_incidents} critical
                          </>
                        ) : metrics.open_incidents > 0 ? (
                          <>
                            <AlertTriangle className="h-3 w-3" />
                            {metrics.warning_incidents} warnings
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-500">All clear</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center",
                      metrics.critical_incidents > 0 ? "bg-red-500/10" : "bg-amber-500/10"
                    )}>
                      <AlertTriangle className={cn(
                        "h-4.5 w-4.5",
                        metrics.critical_incidents > 0 ? "text-red-500" : "text-amber-500"
                      )} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Main Grid */}
            <div className="grid grid-cols-12 gap-4">
              {/* Live Execution Feed - 7 cols */}
              <Card className="col-span-7 bg-zinc-900/50 border-zinc-800" data-tour="live-feed">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Live Execution Feed
                    </CardTitle>
                    <Link href="/executions" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      View all <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <div className="divide-y divide-zinc-800/50">
                    {executions.length > 0 ? executions.slice(0, 8).map((exec) => (
                      <Link
                        key={exec.execution_id}
                        href={`/executions/${exec.execution_id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors"
                      >
                        <StatusBadge status={exec.status} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{exec.agent_id}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{formatDuration(exec.duration_ms)}</span>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-emerald-500">${exec.total_cost_usd.toFixed(4)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <RelativeTime date={exec.started_at} className="text-[10px]" />
                          {exec.status !== "failed" && exec.quality_score && (
                            <QualityScore score={exec.quality_score} size={24} className="mt-1 ml-auto" />
                          )}
                        </div>
                      </Link>
                    )) : (
                      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No executions yet. Run your first agent to see data here.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Right Column - 5 cols */}
              <div className="col-span-5 space-y-4">
                {/* Cost Card */}
                <Card className="bg-zinc-900/50 border-zinc-800" data-tour="cost-card">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        Cost Overview
                      </CardTitle>
                      <Link href="/costs" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        Details <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Today</p>
                          <p className="text-xl font-semibold">
                            <CountUpCurrency value={metrics.cost_today} />
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase">Month</p>
                          <p className="text-lg font-semibold text-muted-foreground">
                            ${metrics.cost_month.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Budget bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Budget usage</span>
                          <span className={cn(
                            budgetStatus === "critical" && "text-red-500",
                            budgetStatus === "warning" && "text-amber-500"
                          )}>
                            {budgetPercentage.toFixed(1)}% of ${metrics.budget_month}
                          </span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              budgetStatus === "critical" && "bg-red-500",
                              budgetStatus === "warning" && "bg-amber-500",
                              budgetStatus === "ok" && "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Cost by agent pie chart */}
                      {costByAgent.length > 0 && (
                        <div className="h-32 mt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={costByAgent}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={25}
                                outerRadius={45}
                                strokeWidth={0}
                              >
                                {costByAgent.map((entry) => (
                                  <Cell key={entry.name} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload?.[0]) {
                                    return (
                                      <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs">
                                        <p className="font-medium">{payload[0].name}</p>
                                        <p className="text-emerald-500">${Number(payload[0].value).toFixed(2)}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Recent Incidents */}
                <Card className="bg-zinc-900/50 border-zinc-800" data-tour="incidents">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Recent Incidents
                      </CardTitle>
                      <Link href="/incidents" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        View all <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <div className="divide-y divide-zinc-800/50">
                      {incidents && incidents.length > 0 ? (
                        incidents.slice(0, 5).map((incident) => (
                          <Link
                            key={incident.id}
                            href={`/incidents/${incident.id}`}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors"
                          >
                            <SeverityBadge severity={incident.severity} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{incident.title}</p>
                              <RelativeTime date={incident.detected_at} className="text-[10px] text-muted-foreground" />
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No open incidents
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            {/* Agents Overview */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-500" />
                    Agent Fleet Status
                  </CardTitle>
                  <Link href="/agents" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    Manage agents <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {agents && agents.length > 0 ? (
                  <div className="grid grid-cols-5 gap-3">
                    {agents.slice(0, 5).map((agent) => {
                      const health = agent.success_rate > 95 ? "healthy" : agent.success_rate > 80 ? "degraded" : "critical";
                      return (
                        <Link
                          key={agent.id}
                          href={`/agents?id=${agent.agent_id}`}
                          className={cn(
                            "p-3 rounded-lg border transition-all",
                            "bg-zinc-800/30 border-zinc-800 hover:border-zinc-700"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <HealthDot health={health} />
                            <span className="text-xs font-medium truncate">{agent.name || agent.agent_id}</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground">Success</span>
                              <span className={cn(
                                health === "healthy" && "text-emerald-500",
                                health === "degraded" && "text-amber-500",
                                health === "critical" && "text-red-500"
                              )}>
                                {agent.success_rate?.toFixed(1) || 0}%
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground">Avg Cost</span>
                              <span className="text-emerald-500">${agent.avg_cost_per_execution?.toFixed(3) || "0.000"}</span>
                            </div>
                            {agent.last_execution_at && (
                              <div className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground">Last run</span>
                                <RelativeTime date={agent.last_execution_at} className="text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No agents registered yet. Install the SDK to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
