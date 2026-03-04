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
      <div className="flex h-screen bg-[hsl(var(--bg-base))]">
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
      <div className="flex h-screen bg-[hsl(var(--bg-base))]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Card className="border-[hsl(var(--error))] bg-[hsl(var(--error-subtle))]">
              <CardContent className="p-6 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-[hsl(var(--error))]" />
                <div>
                  <p className="font-medium text-[hsl(var(--error))]">Failed to load executions</p>
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
      <PageTitle title="Executions" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-5 animate-fade-in">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--text-primary))]">Executions</h1>
                <p className="text-sm text-[hsl(var(--text-muted))] mt-1">
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
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
                <input
                  type="text"
                  placeholder="Search executions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field w-full pl-10 pr-3"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] p-1">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.label}
                    onClick={() => {
                      setStatusFilter(filter.value);
                      setCursor(undefined); // Reset pagination
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                      statusFilter === filter.value
                        ? "bg-[hsl(var(--bg-selected))] text-[hsl(var(--primary))] shadow-sm"
                        : "text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-hover))]"
                    )}
                  >
                    {filter.label}
                    <span className={cn(
                      "tabular-nums",
                      statusFilter === filter.value ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--text-disabled))]"
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
                          <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--bg-base))]">
                            <th className="table-header px-5 py-3 text-left">
                              Agent
                            </th>
                            <th className="table-header px-5 py-3 text-left">
                              Status
                            </th>
                            <th className="table-header px-5 py-3 text-left">
                              Env
                            </th>
                            <th className="table-header px-5 py-3 text-right">
                              LLM
                            </th>
                            <th className="table-header px-5 py-3 text-right">
                              Tokens
                            </th>
                            <th className="table-header px-5 py-3 text-right">
                              Duration
                            </th>
                            <th className="table-header px-5 py-3 text-right">
                              Cost
                            </th>
                            <th className="table-header px-5 py-3 text-right">
                              Started
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[hsl(var(--border-subtle))]">
                          {filteredExecutions.map((exec, index) => (
                            <tr
                              key={exec.execution_id}
                              className={cn(
                                "table-row-hover group animate-fade-in-up",
                                `stagger-${Math.min(index + 1, 6)}`
                              )}
                            >
                              <td className="px-5 py-3">
                                <Link
                                  href={`/executions/${exec.execution_id}`}
                                  className="group/link flex items-center gap-1"
                                >
                                  <span className="text-sm font-medium text-[hsl(var(--text-primary))] group-hover/link:text-[hsl(var(--primary))] transition-colors">
                                    {agentNameMap[exec.agent_id] || exec.agent_id}
                                  </span>
                                  <ExternalLink className="h-3 w-3 text-[hsl(var(--text-muted))] opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                </Link>
                                <p className="text-[10px] text-[hsl(var(--text-disabled))] font-mono mt-0.5">
                                  {exec.execution_id}
                                </p>
                              </td>
                              <td className="px-5 py-3">
                                <StatusBadge status={exec.status} showDot />
                              </td>
                              <td className="px-5 py-3">
                                <span className="inline-flex items-center rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-hover))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--text-secondary))]">
                                  {exec.environment}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span className="text-sm tabular-nums text-[hsl(var(--text-primary))]">{exec.llm_calls_count}</span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span className="text-sm tabular-nums text-[hsl(var(--text-muted))]">
                                  {exec.total_tokens.toLocaleString()}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span className="text-sm font-mono tabular-nums text-[hsl(var(--text-primary))]">
                                  {formatDuration(exec.duration_ms)}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span className="text-sm font-mono tabular-nums text-[hsl(var(--success))]">
                                  ${exec.total_cost_usd.toFixed(4)}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <RelativeTime date={exec.started_at} className="text-xs text-[hsl(var(--text-muted))]" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-[hsl(var(--border-default))] px-5 py-3 bg-[hsl(var(--bg-base))]">
                      <p className="text-xs text-[hsl(var(--text-muted))]">
                        Showing <span className="font-semibold text-[hsl(var(--text-primary))]">{filteredExecutions.length}</span> executions
                        {isFetching && <span className="ml-2 text-[hsl(var(--text-disabled))]">Loading...</span>}
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
                        <span className="text-xs text-[hsl(var(--text-muted))] px-2">
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
