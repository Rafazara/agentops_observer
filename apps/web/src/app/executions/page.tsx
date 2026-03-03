"use client";

import { useState, useMemo } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { ExecutionsSkeleton } from "@/components/ui/skeleton";
import { NoExecutions } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useExecutions, useAgents } from "@/lib/hooks";
import type { ExecutionStatus, Agent } from "@/lib/types";

export default function ExecutionsPage() {
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  
  // Fetch executions with filters
  const { 
    data: executionsData, 
    isLoading, 
    isError, 
    error,
    refetch,
    isFetching 
  } = useExecutions({
    status: statusFilter || undefined,
    limit: 20,
    cursor,
  });

  // Fetch agents to get agent names
  const { data: agents } = useAgents();
  
  // Create a map of agent_id to agent_name
  const agentNameMap = useMemo(() => {
    if (!agents) return {};
    return agents.reduce((acc: Record<string, string>, agent: Agent) => {
      acc[agent.agent_id] = agent.name;
      return acc;
    }, {} as Record<string, string>);
  }, [agents]);

  const executions = executionsData?.data || [];
  const hasMore = executionsData?.has_more || false;
  
  // Calculate status counts from current data
  const statusCounts = useMemo(() => {
    const counts = { all: executions.length, running: 0, completed: 0, failed: 0 };
    executions.forEach(e => {
      if (e.status === "running") counts.running++;
      else if (e.status === "completed") counts.completed++;
      else if (e.status === "failed") counts.failed++;
    });
    return counts;
  }, [executions]);

  const statusFilters = [
    { value: null, label: "All", count: statusCounts.all },
    { value: "running" as ExecutionStatus, label: "Running", count: statusCounts.running },
    { value: "completed" as ExecutionStatus, label: "Completed", count: statusCounts.completed },
    { value: "failed" as ExecutionStatus, label: "Failed", count: statusCounts.failed },
  ];

  // Client-side search filter (server already filters by status)
  const filteredExecutions = useMemo(() => {
    if (!searchQuery) return executions;
    const query = searchQuery.toLowerCase();
    return executions.filter((e) => {
      const agentName = agentNameMap[e.agent_id] || e.agent_id;
      return agentName.toLowerCase().includes(query) ||
        e.execution_id.toLowerCase().includes(query);
    });
  }, [executions, searchQuery, agentNameMap]);

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <ExecutionsSkeleton />
          </main>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-6 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Failed to load executions</p>
                  <p className="text-sm text-muted-foreground">{error?.message || "An error occurred"}</p>
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
    <div className="flex h-screen">
      <PageTitle title="Executions" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-4 animate-fade-in">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Executions</h1>
                <p className="text-sm text-muted-foreground">
                  Monitor and analyze agent execution history
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} />
                {isFetching ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search executions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-md border border-border/50 bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
                />
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border/50 p-0.5">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.label}
                    onClick={() => {
                      setStatusFilter(filter.value);
                      setCursor(undefined); // Reset pagination
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                      statusFilter === filter.value
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {filter.label}
                    <span className={cn(
                      "tabular-nums",
                      statusFilter === filter.value ? "text-accent-foreground/70" : "text-muted-foreground/50"
                    )}>
                      {filter.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Executions table */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {filteredExecutions.length === 0 ? (
                  <NoExecutions className="py-12" />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/50 bg-muted/30">
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Agent
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Env
                            </th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              LLM
                            </th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Tokens
                            </th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Duration
                            </th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Cost
                            </th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Started
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {filteredExecutions.map((exec, index) => (
                            <tr
                              key={exec.execution_id}
                              className={cn(
                                "table-row-hover group animate-fade-in-up",
                                `stagger-${Math.min(index + 1, 6)}`
                              )}
                            >
                              <td className="px-4 py-3">
                                <Link
                                  href={`/executions/${exec.execution_id}`}
                                  className="group/link flex items-center gap-1"
                                >
                                  <span className="text-sm font-medium group-hover/link:text-primary transition-colors">
                                    {agentNameMap[exec.agent_id] || exec.agent_id}
                                  </span>
                                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                </Link>
                                <p className="text-xs text-muted-foreground/70 font-mono">
                                  {exec.execution_id}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={exec.status} showDot />
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center rounded border border-border/50 bg-muted/30 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                                  {exec.environment}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm tabular-nums">{exec.llm_calls_count}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm tabular-nums text-muted-foreground">
                                  {exec.total_tokens.toLocaleString()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-mono tabular-nums">
                                  {formatDuration(exec.duration_ms)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-mono tabular-nums">
                                  ${exec.total_cost_usd.toFixed(4)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <RelativeTime date={exec.started_at} className="text-xs" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-border/50 px-4 py-2.5 bg-muted/20">
                      <p className="text-xs text-muted-foreground">
                        Showing <span className="font-medium text-foreground">{filteredExecutions.length}</span> executions
                        {isFetching && <span className="ml-2 text-muted-foreground/50">Loading...</span>}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={!cursor} 
                          onClick={() => setCursor(undefined)}
                          className="h-7 px-2"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs text-muted-foreground px-2">
                          {hasMore ? "More available" : "All loaded"}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={!hasMore}
                          onClick={() => {
                            if (executionsData?.next_cursor) {
                              setCursor(executionsData.next_cursor);
                            }
                          }}
                          className="h-7 px-2"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
