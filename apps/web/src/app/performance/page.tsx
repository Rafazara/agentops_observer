"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDuration } from "@/lib/utils";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Target,
  BarChart3,
  LineChart,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useExecutionStats } from "@/lib/hooks";

// Mock performance data - replace with real API data
const latencyData = [
  { time: "00:00", p50: 245, p95: 890, p99: 1420 },
  { time: "04:00", p50: 198, p95: 756, p99: 1189 },
  { time: "08:00", p50: 312, p95: 1023, p99: 1756 },
  { time: "12:00", p50: 456, p95: 1345, p99: 2134 },
  { time: "16:00", p50: 389, p95: 1190, p99: 1867 },
  { time: "20:00", p50: 267, p95: 812, p99: 1345 },
  { time: "24:00", p50: 234, p95: 678, p99: 1123 },
];

const throughputData = [
  { time: "Mon", executions: 12450, llm_calls: 34560 },
  { time: "Tue", executions: 15670, llm_calls: 42340 },
  { time: "Wed", executions: 18920, llm_calls: 51230 },
  { time: "Thu", executions: 16780, llm_calls: 45670 },
  { time: "Fri", executions: 21340, llm_calls: 58900 },
  { time: "Sat", executions: 9870, llm_calls: 27890 },
  { time: "Sun", executions: 8540, llm_calls: 23450 },
];

const errorDistribution = [
  { name: "Timeout", value: 35, color: "hsl(var(--chart-1))" },
  { name: "Rate Limit", value: 28, color: "hsl(var(--chart-2))" },
  { name: "Invalid Response", value: 18, color: "hsl(var(--chart-3))" },
  { name: "Auth Error", value: 12, color: "hsl(var(--chart-4))" },
  { name: "Other", value: 7, color: "hsl(var(--chart-5))" },
];

const agentPerformance = [
  { agent: "customer-support", p50: 234, p95: 890, success: 98.5, volume: 12340 },
  { agent: "data-analyst", p50: 456, p95: 1230, success: 97.2, volume: 8920 },
  { agent: "content-writer", p50: 1234, p95: 3450, success: 96.8, volume: 5670 },
  { agent: "code-reviewer", p50: 567, p95: 1560, success: 99.1, volume: 3450 },
  { agent: "research-bot", p50: 890, p95: 2340, success: 95.9, volume: 2890 },
];

export default function PerformancePage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const { data: stats, isLoading } = useExecutionStats();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="text-xs font-medium text-[hsl(var(--text-primary))] mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-xs">
              <span className="text-[hsl(var(--text-muted))]">{entry.name}:</span>
              <span className="font-mono font-medium" style={{ color: entry.color }}>
                {typeof entry.value === "number" && entry.name?.toLowerCase().includes("p") 
                  ? `${entry.value}ms` 
                  : entry.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-screen bg-[hsl(var(--bg-base))]">
      <PageTitle title="Performance" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6 animate-fade-in">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary))] bg-opacity-10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--text-primary))]">
                    Performance Analytics
                  </h1>
                  <p className="text-sm text-[hsl(var(--text-muted))]">
                    Monitor latency, throughput, and error rates
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] p-1">
                {(["24h", "7d", "30d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-all",
                      timeRange === range
                        ? "bg-[hsl(var(--bg-selected))] text-[hsl(var(--primary))]"
                        : "text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))]"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="metric-card">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[hsl(var(--text-muted))] mb-1">P50 Latency</p>
                      {isLoading ? (
                        <Skeleton className="h-8 w-24" />
                      ) : (
                        <p className="kpi-number">312ms</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingDown className="h-3 w-3 text-[hsl(var(--success))]" />
                        <span className="text-xs text-[hsl(var(--success))]">-8.2%</span>
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-[hsl(var(--bg-hover))] flex items-center justify-center">
                      <Clock className="h-5 w-5 text-[hsl(var(--chart-1))]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[hsl(var(--text-muted))] mb-1">P95 Latency</p>
                      {isLoading ? (
                        <Skeleton className="h-8 w-24" />
                      ) : (
                        <p className="kpi-number">1.12s</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingDown className="h-3 w-3 text-[hsl(var(--success))]" />
                        <span className="text-xs text-[hsl(var(--success))]">-12.4%</span>
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-[hsl(var(--bg-hover))] flex items-center justify-center">
                      <Zap className="h-5 w-5 text-[hsl(var(--chart-2))]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[hsl(var(--text-muted))] mb-1">Throughput</p>
                      {isLoading ? (
                        <Skeleton className="h-8 w-24" />
                      ) : (
                        <p className="kpi-number">14.2k/hr</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3 text-[hsl(var(--success))]" />
                        <span className="text-xs text-[hsl(var(--success))]">+18.7%</span>
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-[hsl(var(--bg-hover))] flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-[hsl(var(--chart-3))]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[hsl(var(--text-muted))] mb-1">Success Rate</p>
                      {isLoading ? (
                        <Skeleton className="h-8 w-24" />
                      ) : (
                        <p className="kpi-number text-[hsl(var(--success))]">97.8%</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3 text-[hsl(var(--success))]" />
                        <span className="text-xs text-[hsl(var(--success))]">+0.4%</span>
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-[hsl(var(--success-subtle))] flex items-center justify-center">
                      <Target className="h-5 w-5 text-[hsl(var(--success))]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Latency Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <LineChart className="h-4 w-4 text-[hsl(var(--text-muted))]" />
                      Latency Distribution
                    </CardTitle>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-1))]" />
                        <span className="text-[hsl(var(--text-muted))]">P50</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-2))]" />
                        <span className="text-[hsl(var(--text-muted))]">P95</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-3))]" />
                        <span className="text-[hsl(var(--text-muted))]">P99</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={latencyData}>
                        <defs>
                          <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorP99" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                        <XAxis 
                          dataKey="time" 
                          stroke="hsl(var(--text-disabled))" 
                          tick={{ fontSize: 11, fill: "hsl(var(--text-muted))" }}
                          axisLine={{ stroke: "hsl(var(--border-subtle))" }}
                        />
                        <YAxis 
                          stroke="hsl(var(--text-disabled))" 
                          tick={{ fontSize: 11, fill: "hsl(var(--text-muted))" }}
                          axisLine={{ stroke: "hsl(var(--border-subtle))" }}
                          tickFormatter={(value) => `${value}ms`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="p50"
                          name="P50"
                          stroke="hsl(var(--chart-1))"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorP50)"
                        />
                        <Area
                          type="monotone"
                          dataKey="p95"
                          name="P95"
                          stroke="hsl(var(--chart-2))"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorP95)"
                        />
                        <Area
                          type="monotone"
                          dataKey="p99"
                          name="P99"
                          stroke="hsl(var(--chart-3))"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorP99)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Throughput */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-[hsl(var(--text-muted))]" />
                      Weekly Throughput
                    </CardTitle>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-1))]" />
                        <span className="text-[hsl(var(--text-muted))]">Executions</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-2))]" />
                        <span className="text-[hsl(var(--text-muted))]">LLM Calls</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={throughputData} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" />
                        <XAxis 
                          dataKey="time" 
                          stroke="hsl(var(--text-disabled))"
                          tick={{ fontSize: 11, fill: "hsl(var(--text-muted))" }}
                          axisLine={{ stroke: "hsl(var(--border-subtle))" }}
                        />
                        <YAxis 
                          stroke="hsl(var(--text-disabled))"
                          tick={{ fontSize: 11, fill: "hsl(var(--text-muted))" }}
                          axisLine={{ stroke: "hsl(var(--border-subtle))" }}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="executions" name="Executions" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="llm_calls" name="LLM Calls" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Error Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Error Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={errorDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {errorDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="chart-tooltip">
                                  <p className="text-xs font-medium text-[hsl(var(--text-primary))]">
                                    {payload[0].name}
                                  </p>
                                  <p className="text-sm font-bold" style={{ color: payload[0].payload.color }}>
                                    {payload[0].value}%
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {errorDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="h-2.5 w-2.5 rounded-full" 
                          style={{ backgroundColor: item.color }} 
                        />
                        <span className="text-xs text-[hsl(var(--text-muted))]">{item.name}</span>
                        <span className="text-xs font-medium text-[hsl(var(--text-primary))] ml-auto">
                          {item.value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Agent Performance */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Agent Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-5 gap-4 text-xs font-medium text-[hsl(var(--text-muted))] px-4 py-2 bg-[hsl(var(--bg-hover))] rounded-lg">
                      <span>Agent</span>
                      <span className="text-center">P50 Latency</span>
                      <span className="text-center">P95 Latency</span>
                      <span className="text-center">Success Rate</span>
                      <span className="text-right">Volume</span>
                    </div>
                    {agentPerformance.map((agent) => (
                      <div
                        key={agent.agent}
                        className="grid grid-cols-5 gap-4 items-center px-4 py-3 rounded-lg table-row-hover"
                      >
                        <span className="text-sm font-medium text-[hsl(var(--text-primary))]">
                          {agent.agent}
                        </span>
                        <span className="text-center text-sm font-mono text-[hsl(var(--text-secondary))]">
                          {agent.p50}ms
                        </span>
                        <span className="text-center text-sm font-mono text-[hsl(var(--text-secondary))]">
                          {agent.p95}ms
                        </span>
                        <span className={cn(
                          "text-center text-sm font-medium",
                          agent.success >= 98 ? "text-[hsl(var(--success))]" :
                          agent.success >= 96 ? "text-[hsl(var(--warning))]" :
                          "text-[hsl(var(--error))]"
                        )}>
                          {agent.success}%
                        </span>
                        <span className="text-right text-sm font-mono text-[hsl(var(--text-muted))]">
                          {agent.volume.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
