"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn, formatDuration } from "@/lib/utils";
import {
  Radio,
  Play,
  Pause,
  Trash2,
  Filter,
  Bot,
  Zap,
  DollarSign,
  Clock,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useExecutions } from "@/lib/hooks";
import { useRealtimeUpdates } from "@/lib/websocket";
import { useAuth } from "@/lib/auth";

interface LiveEvent {
  id: string;
  type: "execution_started" | "execution_completed" | "execution_failed" | "llm_call" | "tool_call";
  agent_id: string;
  execution_id: string;
  timestamp: string;
  data: {
    status?: string;
    duration_ms?: number;
    cost?: number;
    model?: string;
    tool_name?: string;
    tokens?: number;
  };
}

export default function LiveFeedPage() {
  const { isAuthenticated } = useAuth();
  const [isPaused, setIsPaused] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch recent executions as initial data
  const { data: executionsData } = useExecutions({ limit: 10 });

  // Initialize with recent executions
  useEffect(() => {
    if (executionsData?.data) {
      const initialEvents: LiveEvent[] = executionsData.data.map((exec) => ({
        id: exec.execution_id,
        type: exec.status === "completed" ? "execution_completed" : 
              exec.status === "failed" ? "execution_failed" : "execution_started",
        agent_id: exec.agent_id,
        execution_id: exec.execution_id,
        timestamp: exec.started_at,
        data: {
          status: exec.status,
          duration_ms: exec.duration_ms,
          cost: exec.total_cost_usd,
          tokens: exec.total_tokens,
        },
      }));
      setEvents(initialEvents);
    }
  }, [executionsData]);

  // WebSocket real-time updates
  useRealtimeUpdates({
    enabled: isAuthenticated && !isPaused,
    onExecutionUpdate: (event) => {
      const newEvent: LiveEvent = {
        id: `${event.execution_id}-${Date.now()}`,
        type: event.status === "completed" ? "execution_completed" :
              event.status === "failed" ? "execution_failed" : "execution_started",
        agent_id: event.agent_id,
        execution_id: event.execution_id,
        timestamp: new Date().toISOString(),
        data: {
          status: event.status,
          duration_ms: event.duration_ms,
          cost: event.cost_usd,
        },
      };
      setEvents((prev) => [newEvent, ...prev.slice(0, 99)]);
    },
  });

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (!isPaused && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length, isPaused]);

  const filteredEvents = filter
    ? events.filter((e) => e.type === filter)
    : events;

  const eventTypeConfig: Record<string, { icon: typeof Zap; color: string; label: string }> = {
    execution_started: { icon: Play, color: "text-[hsl(var(--info))]", label: "Started" },
    execution_completed: { icon: Zap, color: "text-[hsl(var(--success))]", label: "Completed" },
    execution_failed: { icon: Zap, color: "text-[hsl(var(--error))]", label: "Failed" },
    llm_call: { icon: Bot, color: "text-[hsl(var(--chart-2))]", label: "LLM Call" },
    tool_call: { icon: Zap, color: "text-[hsl(var(--chart-3))]", label: "Tool Call" },
  };

  return (
    <div className="flex h-screen bg-[hsl(var(--bg-base))]">
      <PageTitle title="Live Feed" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden p-6">
          <div className="h-full flex flex-col space-y-5 animate-fade-in">
            {/* Page header */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[hsl(var(--success-subtle))] flex items-center justify-center">
                  <Radio className="h-5 w-5 text-[hsl(var(--success))]" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--text-primary))] flex items-center gap-2">
                    Live Feed
                    <span className="live-indicator text-sm font-medium text-[hsl(var(--success))]">
                      {isPaused ? "Paused" : "Live"}
                    </span>
                  </h1>
                  <p className="text-sm text-[hsl(var(--text-muted))]">
                    Real-time stream of agent events
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEvents([])}
                  className="h-8"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Clear
                </Button>
                <Button
                  variant={isPaused ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setIsPaused(!isPaused)}
                  className="h-8"
                >
                  {isPaused ? (
                    <>
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5 mr-1.5" />
                      Pause
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="h-4 w-4 text-[hsl(var(--text-muted))]" />
              <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] p-1">
                <button
                  onClick={() => setFilter(null)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-all",
                    filter === null
                      ? "bg-[hsl(var(--bg-selected))] text-[hsl(var(--primary))]"
                      : "text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]"
                  )}
                >
                  All
                </button>
                {Object.entries(eventTypeConfig).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                      filter === type
                        ? "bg-[hsl(var(--bg-selected))] text-[hsl(var(--primary))]"
                        : "text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]"
                    )}
                  >
                    <config.icon className={cn("h-3 w-3", config.color)} />
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Events stream */}
            <Card className="flex-1 overflow-hidden">
              <CardHeader className="py-3 px-5 border-b border-[hsl(var(--border-default))]">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    Event Stream
                  </CardTitle>
                  <span className="text-xs text-[hsl(var(--text-muted))] tabular-nums">
                    {filteredEvents.length} events
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0 h-[calc(100%-52px)] overflow-hidden">
                <div
                  ref={containerRef}
                  className="h-full overflow-y-auto divide-y divide-[hsl(var(--border-subtle))]"
                >
                  {filteredEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <Radio className="h-12 w-12 text-[hsl(var(--text-disabled))] mb-4" />
                      <p className="text-[hsl(var(--text-muted))] font-medium">No events yet</p>
                      <p className="text-sm text-[hsl(var(--text-disabled))] mt-1">
                        Events will appear here as they happen
                      </p>
                    </div>
                  ) : (
                    filteredEvents.map((event, index) => {
                      const config = eventTypeConfig[event.type];
                      const Icon = config?.icon || Zap;
                      
                      return (
                        <Link
                          key={event.id}
                          href={`/executions/${event.execution_id}`}
                          className={cn(
                            "flex items-center gap-4 px-5 py-3 table-row-hover group",
                            index === 0 && !isPaused && "animate-fade-in-up bg-[hsl(var(--bg-selected))]"
                          )}
                        >
                          {/* Event type icon */}
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                            event.type === "execution_completed" && "bg-[hsl(var(--success-subtle))]",
                            event.type === "execution_failed" && "bg-[hsl(var(--error-subtle))]",
                            event.type === "execution_started" && "bg-[hsl(var(--info-subtle))]",
                            (!event.type.startsWith("execution")) && "bg-[hsl(var(--bg-hover))]"
                          )}>
                            <Icon className={cn("h-4 w-4", config?.color || "text-[hsl(var(--text-muted))]")} />
                          </div>

                          {/* Event details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                                {event.agent_id}
                              </span>
                              <StatusBadge status={event.data.status || event.type.split("_").pop() || "info"} size="sm" />
                            </div>
                            <p className="text-xs text-[hsl(var(--text-muted))] font-mono mt-0.5 truncate">
                              {event.execution_id}
                            </p>
                          </div>

                          {/* Event metrics */}
                          <div className="flex items-center gap-6 shrink-0">
                            {event.data.duration_ms !== undefined && (
                              <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-muted))]">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="tabular-nums font-mono">
                                  {formatDuration(event.data.duration_ms)}
                                </span>
                              </div>
                            )}
                            {event.data.cost !== undefined && (
                              <div className="flex items-center gap-1 text-xs text-[hsl(var(--success))]">
                                <DollarSign className="h-3.5 w-3.5" />
                                <span className="tabular-nums font-mono">
                                  {event.data.cost.toFixed(4)}
                                </span>
                              </div>
                            )}
                            <RelativeTime
                              date={event.timestamp}
                              className="text-xs text-[hsl(var(--text-disabled))] w-16 text-right"
                            />
                            <ChevronRight className="h-4 w-4 text-[hsl(var(--text-disabled))] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
