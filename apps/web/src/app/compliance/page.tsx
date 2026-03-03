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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Shield,
  FileText,
  Download,
  Search,
  Filter,
  Calendar,
  User,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Settings,
  Key,
  Users,
  Bot,
  Trash2,
  Edit,
  Plus,
  LogIn,
  LogOut,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useAuditLog } from "@/lib/hooks";
import type { AuditLogEntry } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

// Known action types for UI styling
type AuditAction = 
  | "user.login"
  | "user.logout"
  | "api_key.create"
  | "api_key.revoke"
  | "agent.create"
  | "agent.update"
  | "agent.delete"
  | "execution.view"
  | "team.invite"
  | "team.remove"
  | "settings.update"
  | "alert.create"
  | "alert.delete"
  | "incident.acknowledge"
  | "incident.resolve";

interface ComplianceReport {
  id: string;
  name: string;
  type: "soc2" | "gdpr" | "hipaa" | "custom";
  generated_at: string;
  status: "ready" | "generating" | "failed";
  size_bytes: number;
  coverage_period: {
    start: string;
    end: string;
  };
}

// ============================================================================
// MOCK DATA (Compliance Reports - no API endpoint yet)
// ============================================================================

const mockComplianceReports: ComplianceReport[] = [
  {
    id: "report-001",
    name: "SOC 2 Type II Audit Report",
    type: "soc2",
    generated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "ready",
    size_bytes: 2456789,
    coverage_period: {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    },
  },
  {
    id: "report-002",
    name: "GDPR Data Processing Report",
    type: "gdpr",
    generated_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: "ready",
    size_bytes: 1234567,
    coverage_period: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    },
  },
  {
    id: "report-003",
    name: "Monthly Access Audit",
    type: "custom",
    generated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "ready",
    size_bytes: 567890,
    coverage_period: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    },
  },
  {
    id: "report-004",
    name: "Q1 2026 Security Report",
    type: "custom",
    generated_at: new Date().toISOString(),
    status: "generating",
    size_bytes: 0,
    coverage_period: {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    },
  },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const ACTION_CONFIG: Record<AuditAction, { icon: React.ElementType; label: string; color: string }> = {
  "user.login": { icon: LogIn, label: "User Login", color: "text-emerald-400" },
  "user.logout": { icon: LogOut, label: "User Logout", color: "text-zinc-400" },
  "api_key.create": { icon: Key, label: "API Key Created", color: "text-blue-400" },
  "api_key.revoke": { icon: Key, label: "API Key Revoked", color: "text-red-400" },
  "agent.create": { icon: Bot, label: "Agent Created", color: "text-emerald-400" },
  "agent.update": { icon: Bot, label: "Agent Updated", color: "text-amber-400" },
  "agent.delete": { icon: Bot, label: "Agent Deleted", color: "text-red-400" },
  "execution.view": { icon: Eye, label: "Execution Viewed", color: "text-zinc-400" },
  "team.invite": { icon: Users, label: "Team Invite Sent", color: "text-blue-400" },
  "team.remove": { icon: Users, label: "Team Member Removed", color: "text-red-400" },
  "settings.update": { icon: Settings, label: "Settings Updated", color: "text-amber-400" },
  "alert.create": { icon: Plus, label: "Alert Created", color: "text-emerald-400" },
  "alert.delete": { icon: Trash2, label: "Alert Deleted", color: "text-red-400" },
  "incident.acknowledge": { icon: CheckCircle2, label: "Incident Acknowledged", color: "text-amber-400" },
  "incident.resolve": { icon: CheckCircle2, label: "Incident Resolved", color: "text-emerald-400" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function ReportTypeBadge({ type }: { type: ComplianceReport["type"] }) {
  const config: Record<ComplianceReport["type"], { label: string; bg: string; text: string }> = {
    soc2: { label: "SOC 2", bg: "bg-purple-500/20", text: "text-purple-400" },
    gdpr: { label: "GDPR", bg: "bg-blue-500/20", text: "text-blue-400" },
    hipaa: { label: "HIPAA", bg: "bg-emerald-500/20", text: "text-emerald-400" },
    custom: { label: "Custom", bg: "bg-zinc-500/20", text: "text-zinc-400" },
  };
  const { label, bg, text } = config[type];
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider", bg, text)}>
      {label}
    </span>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Helper to get config for an action, with fallback for unknown actions
function getActionConfig(action: string) {
  const defaultConfig = { icon: Activity, label: action, color: "text-zinc-400" };
  return ACTION_CONFIG[action as AuditAction] || defaultConfig;
}

export default function CompliancePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);

  // Fetch audit logs from API
  const {
    data: auditData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAuditLog({ limit: 100 });

  const logs = auditData?.data || [];

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        !searchQuery ||
        (log.actor_email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.resource_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAction = !actionFilter || log.action.startsWith(actionFilter);
      return matchesSearch && matchesAction;
    });
  }, [logs, searchQuery, actionFilter]);

  const handleExportPDF = (reportId: string) => {
    // Placeholder for PDF export
    alert(`Downloading report ${reportId}...`);
  };

  const handleGenerateReport = () => {
    alert("Generating new compliance report...");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <div className="space-y-6">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-80" />
              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
              <Skeleton className="h-[400px]" />
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
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Failed to load audit logs</h2>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </p>
              <Button onClick={() => refetch()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <PageTitle title="Compliance" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6 animate-fade-in">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  Compliance & Audit
                </h1>
                <p className="text-sm text-muted-foreground">
                  Audit logs, compliance reports, and security monitoring
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="gap-2"
                >
                  <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                  Refresh
                </Button>
                <Button onClick={handleGenerateReport} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Generate Report
                </Button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      Audit Events (24h)
                    </span>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold">1,247</div>
                  <div className="text-xs text-muted-foreground mt-1">All actions logged</div>
                </CardContent>
              </Card>
              <Card className="border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      Failed Logins
                    </span>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-semibold">3</div>
                  <div className="text-xs text-muted-foreground mt-1">Last 7 days</div>
                </CardContent>
              </Card>
              <Card className="border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      Data Retention
                    </span>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-semibold">90 days</div>
                  <div className="text-xs text-muted-foreground mt-1">Audit log retention</div>
                </CardContent>
              </Card>
              <Card className="border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      Compliance Score
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-semibold text-emerald-400">98%</div>
                  <div className="text-xs text-muted-foreground mt-1">All checks passing</div>
                </CardContent>
              </Card>
            </div>

            {/* Compliance Reports */}
            <Card className="border-zinc-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Compliance Reports
                </CardTitle>
                <CardDescription>
                  Download audit reports for compliance reviews
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-zinc-800">
                  {mockComplianceReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-zinc-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{report.name}</span>
                            <ReportTypeBadge type={report.type} />
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {formatDate(report.coverage_period.start)} — {formatDate(report.coverage_period.end)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <div className="text-muted-foreground">Generated</div>
                          <div className="font-medium">{formatRelativeTime(report.generated_at)}</div>
                        </div>
                        <div className="text-right text-sm w-20">
                          <div className="text-muted-foreground">Size</div>
                          <div className="font-medium">{formatFileSize(report.size_bytes)}</div>
                        </div>
                        {report.status === "ready" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportPDF(report.id)}
                            className="gap-2"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </Button>
                        ) : report.status === "generating" ? (
                          <Button variant="outline" size="sm" disabled className="gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Generating
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled>
                            Failed
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Audit Logs */}
            <Card className="border-zinc-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Audit Log
                    </CardTitle>
                    <CardDescription>
                      Complete history of all user and system actions
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 w-48 rounded-md border border-zinc-700 bg-zinc-900 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <select
                      value={actionFilter || ""}
                      onChange={(e) => setActionFilter(e.target.value || null)}
                      className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">All Actions</option>
                      <option value="user.">User Actions</option>
                      <option value="api_key.">API Key Actions</option>
                      <option value="agent.">Agent Actions</option>
                      <option value="incident.">Incident Actions</option>
                      <option value="team.">Team Actions</option>
                    </select>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50">
                        <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Action
                        </th>
                        <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Resource
                        </th>
                        <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          IP Address
                        </th>
                        <th className="px-4 py-3 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {filteredLogs.map((log) => {
                        const actionConfig = getActionConfig(log.action);
                        const ActionIcon = actionConfig.icon;
                        return (
                          <tr
                            key={log.id}
                            className="hover:bg-zinc-900/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="text-sm font-mono">{formatTime(log.occurred_at)}</div>
                              <div className="text-xs text-muted-foreground">{formatDate(log.occurred_at)}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-semibold">
                                  {(log.actor_email || "?").charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm">{log.actor_email || "Unknown"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ActionIcon className={cn("h-4 w-4", actionConfig.color)} />
                                <span className="text-sm">{actionConfig.label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm">
                                {log.resource_id || "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">{log.resource_type}</div>
                            </td>
                            <td className="px-4 py-3">
                              <code className="text-xs font-mono text-muted-foreground">
                                {log.ip_address || "—"}
                              </code>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Success
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
                  <span className="text-sm text-muted-foreground">
                    Showing {filteredLogs.length} of {auditData?.total || logs.length} events
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={!auditData?.has_more}>
                      Next
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
