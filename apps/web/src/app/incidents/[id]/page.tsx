"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Bell,
  ExternalLink,
  Copy,
  Sparkles,
  RotateCcw,
  DollarSign,
  TrendingDown,
  Activity,
  Zap,
  Timer,
  Check,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type Severity = "critical" | "high" | "warning" | "low";
type IncidentStatus = "open" | "acknowledged" | "resolved";
type IncidentType = "loop" | "cost_spike" | "quality_drop" | "error_rate" | "latency" | "rate_limit";

interface TimelineEntry {
  id: string;
  type: "detected" | "acknowledged" | "action" | "resolved";
  title: string;
  description?: string;
  timestamp: string;
  actor?: string;
}

interface AffectedExecution {
  id: string;
  agent: string;
  status: "failed" | "timeout" | "degraded";
  duration_ms: number;
  error?: string;
  timestamp: string;
}

interface IncidentDetail {
  id: string;
  title: string;
  type: IncidentType;
  severity: Severity;
  status: IncidentStatus;
  affected_agent: string;
  project: string;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  ai_analysis: {
    what_happened: string;
    why_it_happened: string;
    what_to_do: string[];
    confidence: number;
  };
  timeline: TimelineEntry[];
  affected_executions: AffectedExecution[];
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockIncident: IncidentDetail = {
  id: "inc-001",
  title: "Infinite loop detected in workflow execution",
  type: "loop",
  severity: "critical",
  status: "open",
  affected_agent: "Customer Support Bot",
  project: "Support Automation",
  created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  ai_analysis: {
    what_happened: "The Customer Support Bot entered an infinite loop while processing a customer inquiry about order refunds. The agent repeatedly called the 'get_order_details' tool and 'check_refund_policy' tool in a cycle, consuming 847 LLM calls over 6 minutes before detection systems triggered.",
    why_it_happened: "The system prompt lacks a clear exit condition for the refund verification workflow. When the customer's order had a partial refund already applied, the agent entered a state where it continuously re-verified eligibility without recognizing the existing partial refund as a terminal state. This is a prompt engineering issue combined with missing state validation.",
    what_to_do: [
      "Immediately terminate the stuck execution using the emergency stop button",
      "Add a maximum iteration count (suggest: 5) to the refund verification workflow",
      "Update the system prompt to recognize partial refunds as a valid terminal state",
      "Implement tool call deduplication to prevent repeated identical calls within a session",
    ],
    confidence: 94,
  },
  timeline: [
    {
      id: "tl-1",
      type: "detected",
      title: "Anomaly Detected",
      description: "Loop detection system identified repeated tool call pattern",
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    },
    {
      id: "tl-2",
      type: "action",
      title: "Alert Triggered",
      description: "PagerDuty alert sent to on-call engineer",
      timestamp: new Date(Date.now() - 7.5 * 60 * 1000).toISOString(),
      actor: "System",
    },
    {
      id: "tl-3",
      type: "action",
      title: "Execution Paused",
      description: "Automatic circuit breaker activated after 100 tool calls",
      timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      actor: "System",
    },
  ],
  affected_executions: [
    {
      id: "exec-a1",
      agent: "Customer Support Bot",
      status: "failed",
      duration_ms: 367000,
      error: "Execution terminated: loop detection triggered",
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    },
    {
      id: "exec-a2",
      agent: "Customer Support Bot",
      status: "timeout",
      duration_ms: 30000,
      error: "Request timeout waiting for agent response",
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
    {
      id: "exec-a3",
      agent: "Customer Support Bot",
      status: "degraded",
      duration_ms: 45000,
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
  ],
};

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

const SEVERITY_CONFIG: Record<Severity, { color: string; bgColor: string; borderColor: string; bandColor: string; label: string }> = {
  critical: { 
    color: "text-red-400", 
    bgColor: "bg-red-500/20", 
    borderColor: "border-red-500",
    bandColor: "bg-red-500",
    label: "CRITICAL" 
  },
  high: { 
    color: "text-orange-400", 
    bgColor: "bg-orange-500/20", 
    borderColor: "border-orange-500",
    bandColor: "bg-orange-500",
    label: "HIGH" 
  },
  warning: { 
    color: "text-amber-400", 
    bgColor: "bg-amber-500/20", 
    borderColor: "border-amber-500",
    bandColor: "bg-amber-500",
    label: "WARNING" 
  },
  low: { 
    color: "text-blue-400", 
    bgColor: "bg-blue-500/20", 
    borderColor: "border-blue-500",
    bandColor: "bg-blue-500",
    label: "LOW" 
  },
};

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(dateString).toLocaleDateString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider",
        config.bgColor,
        config.color
      )}
    >
      <span className={cn(
        "w-2 h-2 rounded-full",
        severity === "critical" ? "bg-red-400 animate-pulse" : 
        severity === "high" ? "bg-orange-400" : 
        severity === "warning" ? "bg-amber-400" : "bg-blue-400"
      )} />
      {config.label}
    </span>
  );
}

function TimelineItem({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const getIcon = () => {
    switch (entry.type) {
      case "detected":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case "acknowledged":
        return <Bell className="w-4 h-4 text-amber-400" />;
      case "action":
        return <Zap className="w-4 h-4 text-blue-400" />;
      case "resolved":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          entry.type === "detected" ? "bg-red-500/20" :
          entry.type === "acknowledged" ? "bg-amber-500/20" :
          entry.type === "action" ? "bg-blue-500/20" : "bg-emerald-500/20"
        )}>
          {getIcon()}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-zinc-800 my-2" />}
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-zinc-100">{entry.title}</h4>
          <span className="text-xs text-zinc-500">{formatTime(entry.timestamp)}</span>
        </div>
        {entry.description && (
          <p className="text-xs text-zinc-400 mt-1">{entry.description}</p>
        )}
        {entry.actor && (
          <span className="text-[10px] text-zinc-600 mt-1 inline-block">{entry.actor}</span>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-7 w-7 p-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const incidentId = params.id as string;

  // In real app, fetch incident data by ID
  const incident = mockIncident;
  const severityConfig = SEVERITY_CONFIG[incident.severity];
  const typeConfig = INCIDENT_TYPE_CONFIG[incident.type];

  const handleCreateJiraTicket = () => {
    // Webhook integration placeholder
    alert("Creating Jira ticket...");
  };

  const handleShareInSlack = () => {
    // Webhook integration placeholder
    alert("Sharing in Slack...");
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Severity color band */}
      <div className={cn("h-1.5", severityConfig.bandColor)} />

      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/incidents")}
                className="mt-1 gap-2 text-zinc-400 hover:text-zinc-100"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <SeverityBadge severity={incident.severity} />
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium",
                    incident.status === "open" ? "bg-red-500/20 text-red-400" :
                    incident.status === "acknowledged" ? "bg-amber-500/20 text-amber-400" :
                    "bg-emerald-500/20 text-emerald-400"
                  )}>
                    {incident.status === "open" && <AlertTriangle className="w-3 h-3" />}
                    {incident.status === "acknowledged" && <Clock className="w-3 h-3" />}
                    {incident.status === "resolved" && <CheckCircle2 className="w-3 h-3" />}
                    {incident.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-zinc-600 font-mono">{incident.id}</span>
                </div>

                <h1 className="text-xl font-semibold text-zinc-100 mb-1">
                  {typeConfig.emoji} {incident.title}
                </h1>

                <div className="flex items-center gap-3 text-sm text-zinc-500">
                  <span className="font-medium text-zinc-300">{incident.affected_agent}</span>
                  <span>•</span>
                  <span>{incident.project}</span>
                  <span>•</span>
                  <span>Detected {formatTimeAgo(incident.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {incident.status === "open" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 bg-zinc-800 border-zinc-700 hover:bg-amber-500/20 hover:border-amber-500 hover:text-amber-400"
                  >
                    <Bell className="w-4 h-4" />
                    Acknowledge
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Resolve
                  </Button>
                </>
              )}
              {incident.status === "acknowledged" && (
                <Button
                  size="sm"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Resolve
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column - AI Analysis & Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Analysis */}
            <Card className="border-zinc-800 bg-zinc-900/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <CardTitle className="text-base font-medium">AI Analysis</CardTitle>
                  <span className="ml-auto text-xs text-zinc-500">
                    {incident.ai_analysis.confidence}% confidence
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* What happened */}
                <div>
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    What happened
                  </h4>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {incident.ai_analysis.what_happened}
                  </p>
                </div>

                {/* Why it happened */}
                <div>
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Why it happened
                  </h4>
                  <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                    <p className="text-sm text-zinc-300 leading-relaxed font-mono">
                      {incident.ai_analysis.why_it_happened}
                    </p>
                  </div>
                </div>

                {/* What to do */}
                <div>
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    What to do
                  </h4>
                  <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                    <ol className="space-y-2">
                      {incident.ai_analysis.what_to_do.map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-emerald-300">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Affected Executions */}
            <Card className="border-zinc-800 bg-zinc-900/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  Affected Executions
                  <span className="ml-2 text-xs text-zinc-500 font-normal">
                    ({incident.affected_executions.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="px-3 py-2 text-left text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                          Execution ID
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                          Agent
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {incident.affected_executions.map((exec) => (
                        <tr key={exec.id} className="hover:bg-zinc-800/30 cursor-pointer">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono text-zinc-400">{exec.id}</code>
                              <CopyButton text={exec.id} />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-sm text-zinc-300">
                            {exec.agent}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium",
                              exec.status === "failed" ? "bg-red-500/20 text-red-400" :
                              exec.status === "timeout" ? "bg-amber-500/20 text-amber-400" :
                              "bg-yellow-500/20 text-yellow-400"
                            )}>
                              {exec.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-mono text-zinc-400">
                            {formatDuration(exec.duration_ms)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-zinc-500">
                            {formatTimeAgo(exec.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column - Timeline & Actions */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="border-zinc-800 bg-zinc-900/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={handleCreateJiraTicket}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.53 2c-.6 0-1.17.24-1.59.66L2.66 9.94a2.26 2.26 0 000 3.18l7.28 7.28c.42.42.99.66 1.59.66.6 0 1.17-.24 1.59-.66l7.28-7.28a2.26 2.26 0 000-3.18l-7.28-7.28A2.25 2.25 0 0011.53 2zm0 2.16l7.28 7.28-7.28 7.28-7.28-7.28 7.28-7.28z"/>
                  </svg>
                  Create Jira Ticket
                </Button>
                <Button
                  onClick={handleShareInSlack}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.52 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.124a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.52v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                  Share in Slack
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Agent Config
                </Button>
              </CardContent>
            </Card>

            {/* Incident Timeline */}
            <Card className="border-zinc-800 bg-zinc-900/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-zinc-500" />
                  <CardTitle className="text-base font-medium">Timeline</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {incident.timeline.map((entry, i) => (
                    <TimelineItem
                      key={entry.id}
                      entry={entry}
                      isLast={i === incident.timeline.length - 1}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Metrics */}
            <Card className="border-zinc-800 bg-zinc-900/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Impact Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-zinc-100">847</div>
                    <div className="text-xs text-zinc-500">LLM calls wasted</div>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-red-400">$12.34</div>
                    <div className="text-xs text-zinc-500">Cost incurred</div>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-zinc-100">6m 7s</div>
                    <div className="text-xs text-zinc-500">Time to detect</div>
                  </div>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-400">3</div>
                    <div className="text-xs text-zinc-500">Users affected</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
