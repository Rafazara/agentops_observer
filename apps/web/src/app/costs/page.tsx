"use client";

import { useState, useMemo } from "react";
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
import { CountUpCurrency, CountUp } from "@/components/ui/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  DollarSign,
  Lightbulb,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Calendar,
  Zap,
  Bot,
  Cpu,
  PiggyBank,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Treemap,
} from "recharts";
import { useCostsSummary, useCostsForecast, useExportCosts, useAgents } from "@/lib/hooks";
import type { Agent } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

type Period = "today" | "7d" | "30d" | "90d" | "custom";

interface DailyCost {
  date: string;
  cost: number;
  budget: number;
  breakdown: {
    gpt4o: number;
    claude: number;
    other: number;
  };
}

interface TreemapItem {
  name: string;
  size: number;
  efficiency: number; // cost per successful execution
  children?: TreemapItem[];
}

// ============================================================================
// MOCK DATA
// ============================================================================

const periodData: Record<Period, {
  totalCost: number;
  vsPrevious: number;
  vsLastMonth: number;
  projectedMonthEnd: number;
  dailyCosts: DailyCost[];
}> = {
  today: {
    totalCost: 283.45,
    vsPrevious: -8.2,
    vsLastMonth: 12.5,
    projectedMonthEnd: 8565.25,
    dailyCosts: [
      { date: "00:00", cost: 12.5, budget: 12, breakdown: { gpt4o: 8.2, claude: 3.5, other: 0.8 } },
      { date: "04:00", cost: 8.3, budget: 12, breakdown: { gpt4o: 5.1, claude: 2.8, other: 0.4 } },
      { date: "08:00", cost: 45.2, budget: 12, breakdown: { gpt4o: 28.5, claude: 14.2, other: 2.5 } },
      { date: "12:00", cost: 67.8, budget: 12, breakdown: { gpt4o: 42.3, claude: 21.5, other: 4.0 } },
      { date: "16:00", cost: 89.4, budget: 12, breakdown: { gpt4o: 55.8, claude: 28.6, other: 5.0 } },
      { date: "20:00", cost: 60.25, budget: 12, breakdown: { gpt4o: 38.2, claude: 18.5, other: 3.55 } },
    ],
  },
  "7d": {
    totalCost: 1892.34,
    vsPrevious: -5.3,
    vsLastMonth: 18.7,
    projectedMonthEnd: 8145.60,
    dailyCosts: [
      { date: "Mon", cost: 245.6, budget: 285, breakdown: { gpt4o: 152.4, claude: 78.2, other: 15.0 } },
      { date: "Tue", cost: 312.8, budget: 285, breakdown: { gpt4o: 194.1, claude: 99.7, other: 19.0 } },
      { date: "Wed", cost: 278.9, budget: 285, breakdown: { gpt4o: 173.0, claude: 88.9, other: 17.0 } },
      { date: "Thu", cost: 298.4, budget: 285, breakdown: { gpt4o: 185.2, claude: 95.2, other: 18.0 } },
      { date: "Fri", cost: 267.2, budget: 285, breakdown: { gpt4o: 165.8, claude: 85.4, other: 16.0 } },
      { date: "Sat", cost: 189.5, budget: 285, breakdown: { gpt4o: 117.5, claude: 60.5, other: 11.5 } },
      { date: "Sun", cost: 299.94, budget: 285, breakdown: { gpt4o: 186.0, claude: 95.9, other: 18.04 } },
    ],
  },
  "30d": {
    totalCost: 7823.12,
    vsPrevious: 4.2,
    vsLastMonth: 15.3,
    projectedMonthEnd: 7823.12,
    dailyCosts: Array.from({ length: 30 }, (_, i) => ({
      date: `${i + 1}`,
      cost: 200 + Math.random() * 150,
      budget: 280,
      breakdown: { gpt4o: 150 + Math.random() * 80, claude: 40 + Math.random() * 50, other: 10 + Math.random() * 20 },
    })),
  },
  "90d": {
    totalCost: 22456.78,
    vsPrevious: 8.9,
    vsLastMonth: 22.4,
    projectedMonthEnd: 7485.59,
    dailyCosts: Array.from({ length: 12 }, (_, i) => ({
      date: `W${i + 1}`,
      cost: 1500 + Math.random() * 800,
      budget: 1995,
      breakdown: { gpt4o: 1000 + Math.random() * 500, claude: 350 + Math.random() * 200, other: 150 + Math.random() * 100 },
    })),
  },
  custom: {
    totalCost: 4521.67,
    vsPrevious: -2.1,
    vsLastMonth: 9.8,
    projectedMonthEnd: 6782.51,
    dailyCosts: [],
  },
};

const miniCardData = {
  mostExpensiveAgent: { name: "Research Agent", cost: 2456.78 },
  mostExpensiveModel: { name: "GPT-4o", cost: 4523.45, secondary: { name: "Claude 3", cost: 1892.34 } },
  avgCostPerExecution: 0.234,
  estimatedSavings: 1250.0,
};

const treemapData: TreemapItem[] = [
  {
    name: "Marketing",
    size: 0,
    efficiency: 0,
    children: [
      { name: "Content Writer", size: 1245.67, efficiency: 0.23 },
      { name: "Social Media Bot", size: 567.89, efficiency: 0.15 },
      { name: "Email Campaigns", size: 234.56, efficiency: 0.31 },
    ],
  },
  {
    name: "Engineering",
    size: 0,
    efficiency: 0,
    children: [
      { name: "Code Review", size: 1987.34, efficiency: 0.42 },
      { name: "Doc Generator", size: 876.54, efficiency: 0.18 },
      { name: "Bug Analyzer", size: 345.67, efficiency: 0.28 },
    ],
  },
  {
    name: "Support",
    size: 0,
    efficiency: 0,
    children: [
      { name: "Customer Support", size: 1123.45, efficiency: 0.12 },
      { name: "Ticket Classifier", size: 456.78, efficiency: 0.09 },
    ],
  },
  {
    name: "Research",
    size: 0,
    efficiency: 0,
    children: [
      { name: "Research Agent", size: 2345.67, efficiency: 0.56 },
      { name: "Data Analyst", size: 640.12, efficiency: 0.34 },
    ],
  },
];

// Flatten treemap for recharts
const flattenedTreemap = treemapData.flatMap((project) =>
  (project.children || []).map((agent) => ({
    name: agent.name,
    size: agent.size,
    efficiency: agent.efficiency,
    project: project.name,
  }))
);

const modelComparison = {
  current: {
    model: "GPT-4o for all tasks",
    monthlyTotal: 4523.45,
    breakdown: [
      { task: "Simple queries", cost: 1245.67, percentage: 27.5 },
      { task: "Complex reasoning", cost: 2134.56, percentage: 47.2 },
      { task: "Code generation", cost: 1143.22, percentage: 25.3 },
    ],
  },
  suggested: {
    model: "Route simple tasks to Claude Haiku",
    monthlyTotal: 2847.23,
    savings: 1676.22,
    savingsPercent: 37.1,
    breakdown: [
      { task: "Simple queries → Haiku", cost: 312.45, percentage: 11.0, savings: 933.22 },
      { task: "Complex reasoning → GPT-4o", cost: 2134.56, percentage: 75.0, savings: 0 },
      { task: "Code gen → GPT-4o", cost: 400.22, percentage: 14.0, savings: 743.00 },
    ],
  },
};

const periods: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "custom", label: "Custom" },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function DeltaBadge({ value, label, isGood }: { value: number; label: string; isGood?: boolean }) {
  const isPositive = value > 0;
  // For costs, negative is usually good (spending less)
  const showGreen = isGood !== undefined ? isGood : !isPositive;
  
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[hsl(var(--bg-hover))] border border-[hsl(var(--border-default))]">
      {isPositive ? (
        <ArrowUpRight className={cn("w-3.5 h-3.5", showGreen ? "text-[hsl(var(--success))]" : "text-[hsl(var(--error))]")} />
      ) : (
        <ArrowDownRight className={cn("w-3.5 h-3.5", showGreen ? "text-[hsl(var(--success))]" : "text-[hsl(var(--error))]")} />
      )}
      <span className={cn("text-sm font-semibold tabular-nums", showGreen ? "text-[hsl(var(--success))]" : "text-[hsl(var(--error))]")}>
        {isPositive ? "+" : ""}{value.toFixed(1)}%
      </span>
      <span className="text-xs text-[hsl(var(--text-muted))]">{label}</span>
    </div>
  );
}

function MiniCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  iconColor: string;
  className?: string;
}) {
  return (
    <Card className={cn("metric-card", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconColor)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))] font-medium mb-1">
              {label}
            </div>
            <div className="text-lg font-semibold text-[hsl(var(--text-primary))] truncate">{value}</div>
            {subValue && <div className="text-xs text-[hsl(var(--text-muted))] mt-0.5">{subValue}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Custom treemap content renderer
function TreemapContent({ x, y, width, height, name, size, efficiency }: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  size: number;
  efficiency: number;
}) {
  if (width < 50 || height < 30) return null;
  
  // Color intensity based on efficiency (higher = less efficient = more red)
  // Transitions from chart-1 (indigo) to error (red)
  const intensity = Math.min(efficiency / 0.6, 1);
  const bgColor = `hsla(${Math.round(238 * (1 - intensity) + 0 * intensity)}, ${Math.round(84 - intensity * 10)}%, ${Math.round(64 - intensity * 4)}%, 0.8)`;
  
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={bgColor}
        stroke="hsl(240 4% 16%)"
        strokeWidth={1}
        rx={4}
      />
      {width > 60 && height > 40 && (
        <>
          <text
            x={x + 8}
            y={y + 18}
            fill="hsl(0 0% 98%)"
            fontSize={11}
            fontWeight="500"
          >
            {name.length > 15 ? name.slice(0, 15) + "..." : name}
          </text>
          <text
            x={x + 8}
            y={y + 32}
            fill="hsla(0, 0%, 98%, 0.7)"
            fontSize={10}
          >
            ${size.toFixed(0)}
          </text>
        </>
      )}
    </g>
  );
}

// Custom tooltip for bar chart
function CostTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: DailyCost }>; label?: string }) {
  if (!active || !payload?.[0]) return null;
  
  const data = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="text-xs text-[hsl(var(--text-muted))] mb-2">{label}</div>
      <div className="text-lg font-semibold text-[hsl(var(--text-primary))] mb-2">${data.cost.toFixed(2)}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-[hsl(var(--chart-1))]">● GPT-4o</span>
          <span className="text-[hsl(var(--text-secondary))] tabular-nums">${data.breakdown.gpt4o.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-[hsl(var(--chart-2))]">● Claude</span>
          <span className="text-[hsl(var(--text-secondary))] tabular-nums">${data.breakdown.claude.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-[hsl(var(--text-muted))]">● Other</span>
          <span className="text-[hsl(var(--text-secondary))] tabular-nums">${data.breakdown.other.toFixed(2)}</span>
        </div>
      </div>
      {data.cost > data.budget && (
        <div className="mt-2 pt-2 border-t border-[hsl(var(--border-subtle))] text-xs text-[hsl(var(--error))]">
          ⚠ Over budget by ${(data.cost - data.budget).toFixed(2)}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CostsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("7d");
  
  // Fetch costs data from API
  const { 
    data: costsSummary, 
    isLoading, 
    isError, 
    error, 
    refetch, 
    isFetching 
  } = useCostsSummary(selectedPeriod === "today" ? "1d" : selectedPeriod);
  
  const { data: forecast } = useCostsForecast();
  const { data: agents } = useAgents();
  const exportCosts = useExportCosts();

  // Map agent IDs to names
  const agentNameMap = useMemo(() => {
    if (!agents) return {};
    return agents.reduce((acc: Record<string, string>, agent: Agent) => {
      acc[agent.agent_id] = agent.name;
      return acc;
    }, {} as Record<string, string>);
  }, [agents]);

  // Transform API data for display
  const displayData = useMemo(() => {
    if (!costsSummary) return null;
    
    return {
      totalCost: costsSummary.total_cost,
      vsPrevious: costsSummary.cost_change_percent,
      vsLastMonth: costsSummary.cost_change_percent, // Reuse for now
      projectedMonthEnd: forecast?.projected_monthly || costsSummary.total_cost * 4.3,
      dailyCosts: costsSummary.daily.map(d => ({
        date: d.date.slice(5, 10), // MM-DD format
        cost: d.cost,
        budget: 285, // Default budget placeholder
        breakdown: {
          gpt4o: d.cost * 0.62,
          claude: d.cost * 0.30,
          other: d.cost * 0.08,
        },
      })),
    };
  }, [costsSummary, forecast]);

  // Mini card data from API
  const miniCardData = useMemo(() => {
    if (!costsSummary) return null;

    const mostExpensiveAgent = costsSummary.by_agent.length > 0
      ? costsSummary.by_agent.reduce((max, a) => a.cost > max.cost ? a : max, costsSummary.by_agent[0])
      : null;

    const modelsBySpend = [...(costsSummary.by_model || [])].sort((a, b) => b.cost - a.cost);
    const topModel = modelsBySpend[0];
    const secondModel = modelsBySpend[1];

    return {
      mostExpensiveAgent: mostExpensiveAgent 
        ? { name: agentNameMap[mostExpensiveAgent.agent_id] || mostExpensiveAgent.agent_id, cost: mostExpensiveAgent.cost }
        : { name: "N/A", cost: 0 },
      mostExpensiveModel: { 
        name: topModel?.model_id || "GPT-4o", 
        cost: topModel?.cost || 0,
        secondary: secondModel ? { name: secondModel.model_id, cost: secondModel.cost } : undefined
      },
      avgCostPerExecution: costsSummary.execution_count > 0 
        ? costsSummary.total_cost / costsSummary.execution_count 
        : 0,
      estimatedSavings: costsSummary.total_cost * 0.15, // Estimate 15% savings potential
    };
  }, [costsSummary, agentNameMap]);

  const budget = selectedPeriod === "today" ? 12 : selectedPeriod === "7d" ? 285 : 280;

  if (isLoading || !displayData || !miniCardData) {
    return (
      <div className="flex h-screen bg-[hsl(var(--bg-base))]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <Skeleton className="h-20 w-64" />
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-9 w-16" />
                  ))}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: "55% 45%" }}>
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
              </div>
              <Skeleton className="h-64" />
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
                  <p className="font-medium text-[hsl(var(--error))]">Failed to load costs</p>
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
      <PageTitle title="Costs" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-5 animate-fade-in">
            {/* Header with period selector */}
            <div className="flex items-start justify-between">
              {/* Hero Number */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                    Total Cost
                  </h1>
                  <span className="text-xs text-[hsl(var(--text-disabled))]">
                    {selectedPeriod === "today" ? "Today" : 
                     selectedPeriod === "7d" ? "Last 7 Days" :
                     selectedPeriod === "30d" ? "Last 30 Days" :
                     selectedPeriod === "90d" ? "Last 90 Days" : "Custom Range"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
                    $<CountUp value={displayData.totalCost} decimals={2} />
                  </span>
                </div>
                {/* Delta badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <DeltaBadge value={displayData.vsPrevious} label="vs prev period" />
                  <DeltaBadge value={displayData.vsLastMonth} label="vs last month" isGood={displayData.vsLastMonth < 0} />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[hsl(var(--bg-hover))] border border-[hsl(var(--border-default))]">
                    <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
                    <span className="text-sm font-semibold tabular-nums text-[hsl(var(--warning))]">
                      ${displayData.projectedMonthEnd.toLocaleString()}
                    </span>
                    <span className="text-xs text-[hsl(var(--text-muted))]">month-end</span>
                  </div>
                </div>
              </div>

              {/* Period Selector Tabs with actions */}
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 bg-[hsl(var(--bg-surface))] border-[hsl(var(--border-default))]"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} />
                  Refresh
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 bg-[hsl(var(--bg-surface))] border-[hsl(var(--border-default))]"
                  onClick={() => exportCosts.mutate({ period: selectedPeriod })}
                  disabled={exportCosts.isPending}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export CSV
                </Button>
                <div className="flex items-center gap-0.5 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] p-1">
                  {periods.map((period) => (
                    <button
                      key={period.value}
                      onClick={() => setSelectedPeriod(period.value)}
                      className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition-all",
                        selectedPeriod === period.value
                          ? "bg-[hsl(var(--bg-selected))] text-[hsl(var(--primary))] shadow-sm"
                          : "text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-hover))]"
                      )}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mini Cards Row */}
            <div className="grid gap-3 md:grid-cols-4">
              <MiniCard
                icon={Bot}
                label="Most Expensive Agent"
                iconColor="bg-[hsl(var(--chart-1))]/20 text-[hsl(var(--chart-1))]"
                value={miniCardData.mostExpensiveAgent.name}
                subValue={`$${miniCardData.mostExpensiveAgent.cost.toLocaleString()}`}
                className="animate-fade-in-up stagger-1"
              />
              <MiniCard
                icon={Cpu}
                label="Most Expensive Model"
                iconColor="bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]"
                value={miniCardData.mostExpensiveModel.name}
                subValue={
                  <span>
                    ${miniCardData.mostExpensiveModel.cost.toLocaleString()}
                    {miniCardData.mostExpensiveModel.secondary && (
                      <>
                        <span className="text-[hsl(var(--text-disabled))] mx-1">•</span>
                        {miniCardData.mostExpensiveModel.secondary.name} ${miniCardData.mostExpensiveModel.secondary.cost.toLocaleString()}
                      </>
                    )}
                  </span>
                }
                className="animate-fade-in-up stagger-2"
              />
              <MiniCard
                icon={Zap}
                label="Avg Cost / Execution"
                iconColor="bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]"
                value={`$${miniCardData.avgCostPerExecution.toFixed(3)}`}
                className="animate-fade-in-up stagger-3"
              />
              <MiniCard
                icon={PiggyBank}
                label="Est. Monthly Savings"
                iconColor="bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]"
                value={
                  <span className="text-[hsl(var(--success))]">
                    $<CountUp value={miniCardData.estimatedSavings} decimals={0} />
                  </span>
                }
                subValue="if recommendations applied"
                className="animate-fade-in-up stagger-4"
              />
            </div>

            {/* Main Charts Section */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "55% 1fr" }}>
              {/* Daily Cost Bar Chart */}
              <Card className="card-hover animate-fade-in-up stagger-5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-medium">Daily Cost</CardTitle>
                      <CardDescription className="text-xs">
                        Budget: ${budget}/day • Hover for breakdown
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-[hsl(var(--chart-1))]" />
                        <span className="text-[hsl(var(--text-muted))]">Actual</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-0 border-t-2 border-dashed border-[hsl(var(--text-muted))]" />
                        <span className="text-[hsl(var(--text-muted))]">Budget</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={displayData.dailyCosts} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "hsl(240 4% 46%)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(240 4% 16%)" }}
                        />
                        <YAxis
                          tick={{ fill: "hsl(240 4% 46%)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip content={<CostTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                        <ReferenceLine y={budget} stroke="hsl(240 4% 46%)" strokeDasharray="6 4" strokeWidth={2} />
                        <Bar dataKey="cost" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          {displayData.dailyCosts.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.cost > entry.budget ? "hsl(0 84% 60%)" : "hsl(238 84% 64%)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Treemap */}
              <Card className="card-hover animate-fade-in-up stagger-6">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-medium">Cost by Project → Agent</CardTitle>
                      <CardDescription className="text-xs">
                        Size = cost • Color = efficiency (red = expensive per execution)
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={flattenedTreemap}
                        dataKey="size"
                        aspectRatio={4 / 3}
                        stroke="hsl(240 4% 16%)"
                        content={<TreemapContent x={0} y={0} width={0} height={0} name="" size={0} efficiency={0} />}
                      />
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Model Comparison Tool */}
            <Card className="animate-fade-in-up stagger-6">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-[hsl(var(--warning))]" />
                  <CardTitle className="text-base font-medium">What If? Model Router Calculator</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  See how intelligent model routing could reduce your costs
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Current State */}
                  <div className="rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))]/30 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-[hsl(var(--text-secondary))]">Current Setup</h3>
                      <span className="text-xs text-[hsl(var(--text-muted))] bg-[hsl(var(--bg-hover))] px-2 py-0.5 rounded">
                        {modelComparison.current.model}
                      </span>
                    </div>
                    <div className="text-3xl font-bold text-[hsl(var(--text-primary))] mb-4">
                      ${modelComparison.current.monthlyTotal.toLocaleString()}<span className="text-sm font-normal text-[hsl(var(--text-muted))]">/month</span>
                    </div>
                    <div className="space-y-3">
                      {modelComparison.current.breakdown.map((item) => (
                        <div key={item.task}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[hsl(var(--text-muted))]">{item.task}</span>
                            <span className="text-[hsl(var(--text-secondary))] tabular-nums">${item.cost.toFixed(2)}</span>
                          </div>
                          <div className="h-1.5 bg-[hsl(var(--bg-hover))] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[hsl(var(--text-disabled))] rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Suggested State */}
                  <div className="rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-[hsl(var(--success))] text-[hsl(var(--bg-base))] text-[10px] font-semibold px-2 py-0.5 rounded-bl">
                      RECOMMENDED
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-[hsl(var(--success))]">Optimized Setup</h3>
                      <span className="text-xs text-[hsl(var(--success))]/70 bg-[hsl(var(--success))]/20 px-2 py-0.5 rounded">
                        {modelComparison.suggested.model}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3 mb-4">
                      <span className="text-3xl font-bold text-[hsl(var(--success))]">
                        ${modelComparison.suggested.monthlyTotal.toLocaleString()}<span className="text-sm font-normal text-[hsl(var(--success))]/70">/month</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] text-sm font-semibold">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        Save ${modelComparison.suggested.savings.toLocaleString()} ({modelComparison.suggested.savingsPercent}%)
                      </span>
                    </div>
                    <div className="space-y-3">
                      {modelComparison.suggested.breakdown.map((item) => (
                        <div key={item.task}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[hsl(var(--text-muted))]">{item.task}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[hsl(var(--text-secondary))] tabular-nums">${item.cost.toFixed(2)}</span>
                              {item.savings > 0 && (
                                <span className="text-[hsl(var(--success))] text-[10px]">
                                  -${item.savings.toFixed(0)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 bg-[hsl(var(--bg-hover))] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[hsl(var(--success))] rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button className="w-full mt-4 gap-2 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--bg-base))]">
                      <CheckCircle2 className="w-4 h-4" />
                      Apply Recommendation
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
