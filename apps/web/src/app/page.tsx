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
    healthy: "bg-[hsl(var(--success))]",
    degraded: "bg-[hsl(var(--warning))]",
    critical: "bg-[hsl(var(--error))]",
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
    // Using design system chart colors
    const colors = [
      "hsl(231, 77%, 64%)",  // chart-1: primary blue
      "hsl(262, 76%, 60%)",  // chart-2: purple
      "hsl(186, 84%, 45%)",  // chart-3: cyan
      "hsl(142, 71%, 45%)",  // chart-4: green
      "hsl(33, 95%, 55%)",   // chart-5: orange
      "hsl(340, 75%, 55%)",  // chart-6: pink
    ];
    return costs.by_agent.slice(0, 5).map((a, i) => ({
      name: a.agent_id,
      value: a.cost,
      color: colors[i % colors.length],
    }));
  }, [costs]);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[hsl(var(--bg-base))]">
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
    <div className="flex h-screen bg-[hsl(var(--bg-base))]">
      <PageTitle title="Dashboard" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6 animate-fade-in">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--text-primary))]">Mission Control</h1>
                <p className="text-sm text-[hsl(var(--text-muted))] mt-1">
                  Real-time overview of your AI agent fleet
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ConnectionStatus status={wsStatus} />
                <button
                  onClick={() => refetchStats()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border-default))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-hover))] hover:border-[hsl(var(--border-strong))] transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            </div>
            
            {/* KPI Cards Row */}
            <div className="grid grid-cols-4 gap-4" data-tour="kpi-cards">
              {/* Active Agents */}
              <div className="metric-card card-hover">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Fleet Status</p>
                    <p className="kpi-number mt-1">
                      <CountUpNumber value={metrics.active_agents} />
                    </p>
                    <p className="text-xs text-[hsl(var(--success))] mt-1 flex items-center gap-1">
                      <CircleDot className="h-3 w-3 animate-pulse" />
                      {metrics.running_now} running now
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-[hsl(var(--success-subtle))] flex items-center justify-center">
                    <Bot className="h-5 w-5 text-[hsl(var(--success))]" />
                  </div>
                </div>
              </div>
              
              {/* Executions Today */}
              <div className="metric-card card-hover">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Executions (24h)</p>
                    <p className="kpi-number mt-1">
                      <CountUpNumber value={metrics.executions_today} />
                    </p>
                    <p className={cn("text-xs mt-1 flex items-center gap-1", executionChange.positive ? "text-[hsl(var(--success))]" : "text-[hsl(var(--error))]")}>
                      {executionChange.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {executionChange.value}% vs yesterday
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                    <Activity className="h-5 w-5 text-[hsl(var(--primary))]" />
                  </div>
                </div>
              </div>
              
              {/* AI Spend Today */}
              <div className="metric-card card-hover">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">AI Spend Today</p>
                    <p className="kpi-number mt-1">
                      <CountUpCurrency value={metrics.cost_today} />
                    </p>
                    <p className="text-xs text-[hsl(var(--text-muted))] mt-1 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${metrics.cost_month.toLocaleString(undefined, { minimumFractionDigits: 0 })} this month
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-[hsl(var(--chart-2)/0.1)] flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-[hsl(var(--chart-2))]" />
                  </div>
                </div>
              </div>
              
              {/* Open Incidents */}
              <div className={cn(
                "metric-card card-hover",
                metrics.critical_incidents > 0 && "border-[hsl(var(--error))] bg-[hsl(var(--error-subtle))]"
              )}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">Active Incidents</p>
                    <p className="kpi-number mt-1">
                      <CountUpNumber value={metrics.open_incidents} />
                    </p>
                    <p className={cn(
                      "text-xs mt-1 flex items-center gap-1",
                      metrics.critical_incidents > 0 ? "text-[hsl(var(--error))]" : metrics.open_incidents > 0 ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--success))]"
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
                          <CheckCircle2 className="h-3 w-3" />
                          All clear
                        </>
                      )}
                    </p>
                  </div>
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center",
                    metrics.critical_incidents > 0 ? "bg-[hsl(var(--error-subtle))]" : "bg-[hsl(var(--warning-subtle))]"
                  )}>
                    <AlertTriangle className={cn(
                      "h-5 w-5",
                      metrics.critical_incidents > 0 ? "text-[hsl(var(--error))]" : "text-[hsl(var(--warning))]"
                    )} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Main Grid */}
            <div className="grid grid-cols-12 gap-5">
              {/* Live Execution Feed - 7 cols */}
              <Card className="col-span-7" data-tour="live-feed">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-[hsl(var(--warning-subtle))] flex items-center justify-center">
                        <Zap className="h-4 w-4 text-[hsl(var(--warning))]" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold">Live Execution Feed</span>
                        <span className="live-indicator ml-2 text-[10px] text-[hsl(var(--success))] font-medium">Live</span>
                      </div>
                    </CardTitle>
                    <Link href="/executions" className="text-xs text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] flex items-center gap-1 transition-colors">
                      View all <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <div className="divide-y divide-[hsl(var(--border-subtle))]">
                    {executions.length > 0 ? executions.slice(0, 8).map((exec, index) => (
                      <Link
                        key={exec.execution_id}
                        href={`/executions/${exec.execution_id}`}
                        className={cn(
                          "flex items-center gap-3 px-5 py-3 table-row-hover",
                          index === 0 && "animate-fade-in-up"
                        )}
                      >
                        <StatusBadge status={exec.status} size="sm" showDot />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[hsl(var(--text-primary))] truncate">{exec.agent_id}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-[hsl(var(--text-muted))] font-mono">{formatDuration(exec.duration_ms)}</span>
                            <span className="text-[10px] text-[hsl(var(--border-strong))]">•</span>
                            <span className="text-[10px] text-[hsl(var(--success))] font-mono">${exec.total_cost_usd.toFixed(4)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <RelativeTime date={exec.started_at} className="text-[10px] text-[hsl(var(--text-muted))]" />
                          {exec.status !== "failed" && exec.quality_score && (
                            <QualityScore score={exec.quality_score} size={24} className="mt-1 ml-auto" />
                          )}
                        </div>
                      </Link>
                    )) : (
                      <div className="px-5 py-12 text-center text-sm text-[hsl(var(--text-muted))]">
                        No executions yet. Run your first agent to see data here.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Right Column - 5 cols */}
              <div className="col-span-5 space-y-5">
                {/* Cost Card */}
                <Card data-tour="cost-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-[hsl(var(--success-subtle))] flex items-center justify-center">
                          <DollarSign className="h-4 w-4 text-[hsl(var(--success))]" />
                        </div>
                        <span className="text-sm font-semibold">Cost Overview</span>
                      </CardTitle>
                      <Link href="/costs" className="text-xs text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] flex items-center gap-1 transition-colors">
                        Details <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-[10px] text-[hsl(var(--text-muted))] uppercase font-semibold tracking-wider">Today</p>
                          <p className="text-2xl font-bold text-[hsl(var(--text-primary))] tabular-nums">
                            <CountUpCurrency value={metrics.cost_today} />
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-[hsl(var(--text-muted))] uppercase font-semibold tracking-wider">Month</p>
                          <p className="text-lg font-semibold text-[hsl(var(--text-secondary))] tabular-nums">
                            ${metrics.cost_month.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Budget bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-[hsl(var(--text-muted))]">
                          <span className="font-medium">Budget usage</span>
                          <span className={cn(
                            "font-semibold",
                            budgetStatus === "critical" && "text-[hsl(var(--error))]",
                            budgetStatus === "warning" && "text-[hsl(var(--warning))]"
                          )}>
                            {budgetPercentage.toFixed(1)}% of ${metrics.budget_month}
                          </span>
                        </div>
                        <div className="h-2 bg-[hsl(var(--bg-hover))] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              budgetStatus === "critical" && "bg-[hsl(var(--error))]",
                              budgetStatus === "warning" && "bg-[hsl(var(--warning))]",
                              budgetStatus === "ok" && "bg-[hsl(var(--success))]"
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
                                      <div className="chart-tooltip">
                                        <p className="font-semibold text-[hsl(var(--text-primary))]">{payload[0].name}</p>
                                        <p className="text-[hsl(var(--success))] font-mono">${Number(payload[0].value).toFixed(2)}</p>
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
                <Card data-tour="incidents">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-[hsl(var(--error-subtle))] flex items-center justify-center">
                          <AlertTriangle className="h-4 w-4 text-[hsl(var(--error))]" />
                        </div>
                        <span className="text-sm font-semibold">Recent Incidents</span>
                      </CardTitle>
                      <Link href="/incidents" className="text-xs text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] flex items-center gap-1 transition-colors">
                        View all <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <div className="divide-y divide-[hsl(var(--border-subtle))]">
                      {incidents && incidents.length > 0 ? (
                        incidents.slice(0, 5).map((incident) => (
                          <Link
                            key={incident.id}
                            href={`/incidents/${incident.id}`}
                            className="flex items-center gap-3 px-5 py-3 table-row-hover"
                          >
                            <SeverityBadge severity={incident.severity} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[hsl(var(--text-primary))] truncate">{incident.title}</p>
                              <RelativeTime date={incident.detected_at} className="text-[10px] text-[hsl(var(--text-muted))]" />
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="px-5 py-8 text-center text-sm text-[hsl(var(--text-muted))]">
                          No open incidents
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            {/* Agents Overview */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                      <Bot className="h-4 w-4 text-[hsl(var(--primary))]" />
                    </div>
                    <span className="text-sm font-semibold">Agent Fleet Status</span>
                  </CardTitle>
                  <Link href="/agents" className="text-xs text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] flex items-center gap-1 transition-colors">
                    Manage agents <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {agents && agents.length > 0 ? (
                  <div className="grid grid-cols-5 gap-4">
                    {agents.slice(0, 5).map((agent) => {
                      const health = agent.success_rate > 95 ? "healthy" : agent.success_rate > 80 ? "degraded" : "critical";
                      return (
                        <Link
                          key={agent.id}
                          href={`/agents?id=${agent.agent_id}`}
                          className={cn(
                            "p-4 rounded-xl border transition-all card-hover",
                            "bg-[hsl(var(--bg-base))] border-[hsl(var(--border-default))]"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <HealthDot health={health} />
                            <span className="text-sm font-semibold text-[hsl(var(--text-primary))] truncate">{agent.name || agent.agent_id}</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-[hsl(var(--text-muted))]">Success</span>
                              <span className={cn(
                                "font-semibold tabular-nums",
                                health === "healthy" && "text-[hsl(var(--success))]",
                                health === "degraded" && "text-[hsl(var(--warning))]",
                                health === "critical" && "text-[hsl(var(--error))]"
                              )}>
                                {agent.success_rate?.toFixed(1) || 0}%
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-[hsl(var(--text-muted))]">Avg Cost</span>
                              <span className="text-[hsl(var(--success))] font-mono">${agent.avg_cost_per_execution?.toFixed(3) || "0.000"}</span>
                            </div>
                            {agent.last_execution_at && (
                              <div className="flex justify-between text-xs">
                                <span className="text-[hsl(var(--text-muted))]">Last run</span>
                                <RelativeTime date={agent.last_execution_at} className="text-[hsl(var(--text-muted))]" />
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-[hsl(var(--text-muted))]">
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
