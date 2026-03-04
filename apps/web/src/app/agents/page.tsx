"use client";

import { useMemo } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageTitle } from "@/components/layout/page-title";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountUpNumber, CountUpCurrency } from "@/components/ui/count-up";
import { StatusBadge } from "@/components/ui/status-badge";
import { QualityScore } from "@/components/ui/circular-progress";
import { RelativeTime } from "@/components/ui/relative-time";
import { AgentsSkeleton } from "@/components/ui/skeleton";
import { NoAgents } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  Activity,
  Bot,
  DollarSign,
  Settings,
  TrendingUp,
  Zap,
  Plus,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useAgents } from "@/lib/hooks";
import type { Agent } from "@/lib/types";

export default function AgentsPage() {
  const { 
    data: agentsData, 
    isLoading, 
    isError, 
    error, 
    refetch, 
    isFetching 
  } = useAgents();

  const agents: Agent[] = agentsData || [];

  // Calculate summary metrics
  const { activeAgents, totalExecutions, avgSuccessRate, totalCost } = useMemo(() => {
    const activeAgents = agents.filter((a: Agent) => a.is_active);
    const totalExecutions = agents.reduce((sum: number, a: Agent) => sum + a.total_executions, 0);
    const avgSuccessRate = agents.length > 0 
      ? agents.reduce((sum: number, a: Agent) => sum + a.success_rate, 0) / agents.length 
      : 0;
    const totalCost = agents.reduce(
      (sum: number, a: Agent) => sum + (a.avg_cost_per_execution * a.total_executions), 
      0
    );
    return { activeAgents, totalExecutions, avgSuccessRate, totalCost };
  }, [agents]);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[hsl(var(--bg-base))]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <AgentsSkeleton />
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
                  <p className="font-medium text-[hsl(var(--error))]">Failed to load agents</p>
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
      <PageTitle title="Agents" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-5 animate-fade-in">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--text-primary))]">Agents</h1>
                <p className="text-sm text-[hsl(var(--text-muted))]">
                  Manage and monitor your AI agent fleet
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} />
                  Refresh
                </Button>
                <Button size="sm" className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Register Agent
                </Button>
              </div>
            </div>

            {/* Summary metrics */}
            <div className="grid gap-3 md:grid-cols-4">
              <Card className="metric-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                      Active Agents
                    </span>
                    <Bot className="h-4 w-4 text-[hsl(var(--text-disabled))]" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <CountUpNumber value={activeAgents.length} className="text-2xl font-semibold text-[hsl(var(--text-primary))]" />
                    <span className="text-sm text-[hsl(var(--text-muted))]">
                      / {agents.length}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="metric-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                      Total Executions
                    </span>
                    <Activity className="h-4 w-4 text-[hsl(var(--text-disabled))]" />
                  </div>
                  <CountUpNumber value={totalExecutions} className="text-2xl font-semibold text-[hsl(var(--text-primary))]" />
                </CardContent>
              </Card>
              <Card className="metric-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                      Avg Success Rate
                    </span>
                    <TrendingUp className="h-4 w-4 text-[hsl(var(--text-disabled))]" />
                  </div>
                  <div className="flex items-baseline">
                    <CountUpNumber value={avgSuccessRate} className="text-2xl font-semibold text-[hsl(var(--text-primary))]" />
                    <span className="text-lg font-semibold text-[hsl(var(--text-primary))]">%</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="metric-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                      Total Cost
                    </span>
                    <DollarSign className="h-4 w-4 text-[hsl(var(--text-disabled))]" />
                  </div>
                  <CountUpCurrency value={totalCost} className="text-2xl font-semibold text-[hsl(var(--text-primary))]" />
                </CardContent>
              </Card>
            </div>

            {/* Agents grid */}
            {agents.length === 0 ? (
              <NoAgents />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent, index) => (
                  <Card
                    key={agent.agent_id}
                    className={cn(
                      "card-hover overflow-hidden animate-fade-in-up",
                      `stagger-${Math.min(index + 1, 6)}`,
                      !agent.is_active && "opacity-60"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-medium truncate">
                              <Link
                                href={`/agents/${agent.agent_id}`}
                                className="hover:text-primary transition-colors inline-flex items-center gap-1 group"
                              >
                                {agent.name}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {agent.current_version ? `v${agent.current_version}` : agent.environment}
                            </CardDescription>
                          </div>
                        </div>
                        <StatusBadge
                          status={agent.is_active ? "success" : "neutral"}
                          size="sm"
                        >
                          {agent.is_active ? "Active" : "Inactive"}
                        </StatusBadge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-[hsl(var(--text-muted))] mb-4 line-clamp-2">
                        {agent.description || "No description available"}
                      </p>
                      
                      {/* Quality score and metrics */}
                      <div className="flex items-center gap-4 mb-4">
                        <QualityScore score={Math.round(agent.success_rate)} size={48} />
                        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
                          <div>
                            <div className="flex items-center gap-1 text-[hsl(var(--text-muted))]">
                              <Zap className="h-3 w-3" />
                              <span className="text-xs">Runs</span>
                            </div>
                            <span className="text-sm font-medium tabular-nums text-[hsl(var(--text-primary))]">
                              {agent.total_executions}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[hsl(var(--text-muted))]">
                              <TrendingUp className="h-3 w-3" />
                              <span className="text-xs">Success</span>
                            </div>
                            <span className="text-sm font-medium tabular-nums text-[hsl(var(--text-primary))]">
                              {agent.success_rate.toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[hsl(var(--text-muted))]">
                              <DollarSign className="h-3 w-3" />
                              <span className="text-xs">Avg Cost</span>
                            </div>
                            <span className="text-sm font-medium font-mono tabular-nums text-[hsl(var(--text-primary))]">
                              ${agent.avg_cost_per_execution.toFixed(4)}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[hsl(var(--text-muted))]">
                              <Activity className="h-3 w-3" />
                              <span className="text-xs">Env</span>
                            </div>
                            <span className="text-sm font-medium tabular-nums capitalize text-[hsl(var(--text-primary))]">
                              {agent.environment}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--border-subtle))]">
                        <span className="text-xs text-[hsl(var(--text-muted))]">
                          Last run: {agent.last_execution_at ? <RelativeTime date={agent.last_execution_at} /> : "Never"}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2">
                            <Activity className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2">
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
