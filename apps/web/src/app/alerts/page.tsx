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
import { CountUpNumber } from "@/components/ui/count-up";
import { RelativeTime } from "@/components/ui/relative-time";
import { NoAlerts } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Bell,
  BellRing,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Webhook,
  Zap,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  useAlertRules,
  useUpdateAlertRule,
  useDeleteAlertRule,
  useTestAlertRule,
} from "@/lib/hooks";
import type { AlertRule } from "@/lib/types";

// Helper to format conditions (API uses generic Record<string, unknown>)
interface RuleConditions {
  metric?: string;
  operator?: string;
  threshold?: number;
  unit?: string;
  window_minutes?: number;
}

function formatCondition(conditions: Record<string, unknown>) {
  const c = conditions as RuleConditions;
  const operators: Record<string, string> = {
    ">=": "≥",
    ">": ">",
    "<=": "≤",
    "<": "<",
    "==": "=",
  };
  const metric = c.metric || "unknown";
  const operator = operators[c.operator || ">="] || c.operator || "≥";
  const unitPrefix = c.unit === "$" ? "$" : "";
  const unitSuffix = c.unit && c.unit !== "$" ? c.unit : "";
  const threshold = c.threshold ?? 0;
  return `${metric.replace(/_/g, " ")} ${operator} ${unitPrefix}${threshold}${unitSuffix}`;
}

function getWindowMinutes(conditions: Record<string, unknown>): number {
  return (conditions as RuleConditions).window_minutes ?? 5;
}

// Map channel string to icon
function getChannelDisplay(channel: string) {
  const lowerChannel = channel.toLowerCase();
  if (lowerChannel.includes("slack")) {
    return { icon: MessageSquare, label: "Slack" };
  }
  if (lowerChannel.includes("email")) {
    return { icon: Mail, label: "Email" };
  }
  if (lowerChannel.includes("webhook")) {
    return { icon: Webhook, label: "Webhook" };
  }
  return { icon: Bell, label: channel };
}

export default function AlertsPage() {
  // Fetch alert rules from API
  const { 
    data: alertRules, 
    isLoading, 
    isError, 
    error, 
    refetch, 
    isFetching 
  } = useAlertRules();
  
  // Mutations
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();
  const testRule = useTestAlertRule();

  // Computed values
  const rules = alertRules || [];
  const enabledRules = rules.filter((r) => r.enabled);
  const totalTriggers = rules.reduce((sum, r) => sum + r.trigger_count, 0);
  
  // Unique channels in use
  const channelsInUse = useMemo(() => {
    const channels = new Set<string>();
    rules.forEach(rule => {
      rule.channels?.forEach(ch => {
        const { label } = getChannelDisplay(ch);
        channels.add(label);
      });
    });
    return Array.from(channels);
  }, [rules]);

  // Handlers
  const handleToggleEnabled = (rule: AlertRule) => {
    updateRule.mutate({ id: rule.id, data: { enabled: !rule.enabled } });
  };

  const handleDelete = (ruleId: string) => {
    if (confirm("Are you sure you want to delete this alert rule?")) {
      deleteRule.mutate(ruleId);
    }
  };

  const handleTest = (ruleId: string) => {
    testRule.mutate(ruleId);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-9 w-28" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-40" />
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
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-6 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Failed to load alert rules</p>
                  <p className="text-sm text-muted-foreground">{error?.message || "Unknown error"}</p>
                </div>
                <Button variant="outline" onClick={() => refetch()} className="ml-auto">
                  <RefreshCw className="h-4 w-4 mr-2" />
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
      <PageTitle title="Alerts" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-5 animate-fade-in">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Alert Rules
                </h1>
                <p className="text-sm text-muted-foreground">
                  Configure automated alerts for your agent fleet
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
                  Create Rule
                </Button>
              </div>
            </div>

            {/* Summary */}
            <div className="grid gap-3 md:grid-cols-3">
              <Card className="metric-card animate-fade-in-up stagger-1">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Active Rules
                    </span>
                    <BellRing className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <div className="text-2xl font-semibold tabular-nums">
                    <CountUpNumber value={enabledRules.length} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    of {rules.length} total
                  </p>
                </CardContent>
              </Card>
              <Card className="metric-card animate-fade-in-up stagger-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Triggers (24h)
                    </span>
                    <Zap className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <div className="text-2xl font-semibold tabular-nums">
                    <CountUpNumber value={totalTriggers} />
                  </div>
                </CardContent>
              </Card>
              <Card className="metric-card animate-fade-in-up stagger-3">
                <CardContent className="p-4">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Notification Channels
                  </span>
                  <div className="flex gap-2 mt-3">
                    {channelsInUse.length > 0 ? (
                      channelsInUse.map((channel) => {
                        const Icon = channel === "Slack" ? MessageSquare : channel === "Email" ? Mail : Webhook;
                        return (
                          <div key={channel} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-muted">
                            <Icon className="h-3 w-3" />
                            {channel}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-xs text-muted-foreground">No channels configured</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alert rules list */}
            {rules.length === 0 ? (
              <NoAlerts />
            ) : (
              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <Card
                    key={rule.id}
                    className={cn(
                      "card-hover animate-fade-in-up",
                      `stagger-${index + 1}`,
                      !rule.enabled && "opacity-50"
                    )}
                  >
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "p-2 rounded-md",
                              rule.enabled
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <Bell className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-medium">
                              {rule.name}
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                              {rule.description}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleEnabled(rule)}
                            className={cn(
                              "flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors",
                              rule.enabled
                                ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                          >
                            {rule.enabled ? (
                              <ToggleRight className="h-3.5 w-3.5" />
                            ) : (
                              <ToggleLeft className="h-3.5 w-3.5" />
                            )}
                            {rule.enabled ? "Enabled" : "Disabled"}
                          </button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">
                            Condition
                          </div>
                          <code className="text-xs bg-muted/50 px-2 py-1 rounded border border-border/50 font-mono">
                            {formatCondition(rule.conditions)}
                          </code>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({getWindowMinutes(rule.conditions)}m window)
                          </span>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">
                            Notifications
                          </div>
                          <div className="flex gap-1">
                            {rule.channels?.map((channel) => {
                              const display = getChannelDisplay(channel);
                              const Icon = display.icon;
                              return (
                                <span key={channel} className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  <Icon className="h-3 w-3" />
                                  {display.label}
                                </span>
                              );
                            })}
                            {(!rule.channels || rule.channels.length === 0) && (
                              <span className="text-xs text-muted-foreground">None configured</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">
                            Stats
                          </div>
                          <div className="text-sm">
                            <span className="font-medium tabular-nums">
                              {rule.trigger_count}
                            </span>{" "}
                            <span className="text-muted-foreground">triggers</span>
                            {rule.last_triggered_at && (
                              <span className="text-xs text-muted-foreground ml-2">
                                · Last: <RelativeTime date={rule.last_triggered_at} />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => handleTest(rule.id)}
                          disabled={testRule.isPending}
                        >
                          {testRule.isPending ? "Testing..." : "Test Rule"}
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          View History
                        </Button>
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