"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageTitle } from "@/components/layout/page-title";
import { Footer } from "@/components/layout/footer";
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
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Users,
  Mail,
  Webhook,
  Bell,
  CreditCard,
  Building2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Shield,
} from "lucide-react";
import { useApiKeys, useRevokeApiKey } from "@/lib/hooks";

// ============================================================================
// TYPES
// ============================================================================

// Keep the local interface for display - team and integrations are still mock
interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "viewer";
  status: "active" | "pending";
  joined_at: string;
}

interface Integration {
  id: string;
  name: string;
  type: "slack" | "pagerduty" | "jira" | "email" | "webhook";
  status: "connected" | "disconnected" | "error";
  config?: Record<string, string>;
}

// ============================================================================
// MOCK DATA (Team & Integrations - API not yet available)
// ============================================================================

const mockTeamMembers: TeamMember[] = [
  {
    id: "user-001",
    email: "admin@company.com",
    name: "Alex Johnson",
    role: "owner",
    status: "active",
    joined_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "user-002",
    email: "sarah@company.com",
    name: "Sarah Chen",
    role: "admin",
    status: "active",
    joined_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "user-003",
    email: "mike@company.com",
    name: "Mike Williams",
    role: "member",
    status: "active",
    joined_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "user-004",
    email: "pending@company.com",
    name: "",
    role: "member",
    status: "pending",
    joined_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockIntegrations: Integration[] = [
  { id: "int-001", name: "Slack", type: "slack", status: "connected", config: { channel: "#alerts" } },
  { id: "int-002", name: "PagerDuty", type: "pagerduty", status: "connected" },
  { id: "int-003", name: "Jira", type: "jira", status: "disconnected" },
  { id: "int-004", name: "Email Alerts", type: "email", status: "connected", config: { recipients: "3 recipients" } },
  { id: "int-005", name: "Custom Webhook", type: "webhook", status: "error" },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function CopyButton({ text, className }: { text: string; className?: string }) {
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
      className={cn("h-8 w-8 p-0", className)}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

function RoleBadge({ role }: { role: TeamMember["role"] }) {
  const config: Record<TeamMember["role"], { bg: string; text: string }> = {
    owner: { bg: "bg-purple-500/20", text: "text-purple-400" },
    admin: { bg: "bg-blue-500/20", text: "text-blue-400" },
    member: { bg: "bg-zinc-500/20", text: "text-zinc-400" },
    viewer: { bg: "bg-zinc-500/20", text: "text-zinc-500" },
  };
  const { bg, text } = config[role];
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider", bg, text)}>
      {role}
    </span>
  );
}

function IntegrationIcon({ type }: { type: Integration["type"] }) {
  const icons: Record<Integration["type"], React.ReactNode> = {
    slack: <span className="text-lg">💬</span>,
    pagerduty: <span className="text-lg">📟</span>,
    jira: <span className="text-lg">🎫</span>,
    email: <Mail className="h-5 w-5 text-zinc-400" />,
    webhook: <Webhook className="h-5 w-5 text-zinc-400" />,
  };
  return icons[type];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateString);
}

// ============================================================================
// TAB COMPONENTS
// ============================================================================

type SettingsTab = "api-keys" | "team" | "integrations" | "billing" | "organization";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "team", label: "Team", icon: Users },
  { id: "integrations", label: "Integrations", icon: Webhook },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "organization", label: "Organization", icon: Building2 },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("api-keys");
  const [showKey, setShowKey] = useState<string | null>(null);

  // API hooks for API keys
  const { 
    data: apiKeys, 
    isLoading: isLoadingKeys, 
    isError: isErrorKeys, 
    error: errorKeys, 
    refetch: refetchKeys,
    isFetching: isFetchingKeys
  } = useApiKeys();
  
  const revokeApiKey = useRevokeApiKey();
  
  // Get first key for quickstart example
  const firstKey = apiKeys?.[0];
  
  // Handler for deleting API key
  const handleRevokeKey = (keyId: string) => {
    if (confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      revokeApiKey.mutate(keyId);
    }
  };

  // Overall loading state (just for API keys tab for now)
  const isLoading = activeTab === "api-keys" && isLoadingKeys;

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-64" />
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-9 w-28" />
                ))}
              </div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <PageTitle title="Settings" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
            {/* Page header */}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Manage your account, API keys, team, and integrations
              </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-border pb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px",
                    activeTab === tab.id
                      ? "border-primary text-foreground bg-accent/50"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {/* API Keys Tab */}
              {activeTab === "api-keys" && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-medium">API Keys</h2>
                      <p className="text-sm text-muted-foreground">
                        Manage API keys for SDK authentication
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => refetchKeys()}
                        disabled={isFetchingKeys}
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", isFetchingKeys && "animate-spin")} />
                        Refresh
                      </Button>
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create Key
                      </Button>
                    </div>
                  </div>

                  {isErrorKeys ? (
                    <Card className="border-destructive/50 bg-destructive/5">
                      <CardContent className="p-6 flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <div>
                          <p className="font-medium text-destructive">Failed to load API keys</p>
                          <p className="text-sm text-muted-foreground">{errorKeys?.message || "Unknown error"}</p>
                        </div>
                        <Button variant="outline" onClick={() => refetchKeys()} className="ml-auto">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retry
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-zinc-800">
                      <CardContent className="p-0 divide-y divide-zinc-800">
                        {(!apiKeys || apiKeys.length === 0) ? (
                          <div className="p-8 text-center">
                            <Key className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                            <p className="text-muted-foreground">No API keys yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Create your first API key to get started</p>
                          </div>
                        ) : (
                          apiKeys.map((key) => (
                            <div
                              key={key.id}
                              className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                                  <Key className="h-5 w-5 text-zinc-400" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{key.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {key.scopes.length} scopes
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <code className="text-xs bg-zinc-800 px-2 py-0.5 rounded font-mono">
                                      {showKey === key.id ? `${key.key_prefix}...xxxxxxxxxxxx` : `${key.key_prefix}...****`}
                                    </code>
                                    <button
                                      onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      {showKey === key.id ? (
                                        <EyeOff className="h-3.5 w-3.5" />
                                      ) : (
                                        <Eye className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                    <CopyButton text={key.key_prefix} />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right text-sm">
                                  <div className="text-muted-foreground">Last used</div>
                                  <div className="font-medium">
                                    {formatRelativeTime(key.last_used_at || null)}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  onClick={() => handleRevokeKey(key.id)}
                                  disabled={revokeApiKey.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Quickstart */}
                  <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-primary" />
                        Quick Start
                      </CardTitle>
                      <CardDescription>
                        Install the SDK and start tracing in under 2 minutes
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            1. Install the SDK
                          </span>
                          <CopyButton text="pip install agentops-observer" />
                        </div>
                        <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm font-mono overflow-x-auto">
                          <code className="text-emerald-400">pip install</code>{" "}
                          <code>agentops-observer</code>
                        </pre>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            2. Initialize & trace your agent
                          </span>
                          <CopyButton text={`import agentops

agentops.init(api_key="${firstKey?.key_prefix || "YOUR_API_KEY"}...")

@agentops.trace()
async def my_agent(task: str):
    # Your agent logic here
    return result`} />
                        </div>
                        <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm font-mono overflow-x-auto">
                          <code>
                            <span className="text-purple-400">import</span> agentops{"\n\n"}
                            <span className="text-zinc-500"># Initialize with your API key</span>{"\n"}
                            agentops.<span className="text-amber-400">init</span>(api_key=<span className="text-emerald-400">"{firstKey?.key_prefix || "YOUR_API_KEY"}..."</span>){"\n\n"}
                            <span className="text-purple-400">@</span>agentops.<span className="text-amber-400">trace</span>(){"\n"}
                            <span className="text-purple-400">async def</span> <span className="text-blue-400">my_agent</span>(task: <span className="text-cyan-400">str</span>):{"\n"}
                            {"    "}<span className="text-zinc-500"># Your agent logic here</span>{"\n"}
                            {"    "}<span className="text-purple-400">return</span> result
                          </code>
                        </pre>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button variant="outline" size="sm" className="gap-2">
                          <ExternalLink className="h-3.5 w-3.5" />
                          View Full Documentation
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Team Tab */}
              {activeTab === "team" && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-medium">Team Members</h2>
                      <p className="text-sm text-muted-foreground">
                        Manage who has access to your organization
                      </p>
                    </div>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Invite Member
                    </Button>
                  </div>

                  <Card className="border-zinc-800">
                    <CardContent className="p-0 divide-y divide-zinc-800">
                      {mockTeamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-semibold">
                              {member.name ? member.name.charAt(0).toUpperCase() : "?"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {member.name || member.email}
                                </span>
                                <RoleBadge role={member.role} />
                                {member.status === "pending" && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">
                                    PENDING
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mt-0.5">
                                {member.email}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                              Joined {formatDate(member.joined_at)}
                            </span>
                            {member.role !== "owner" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === "integrations" && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-lg font-medium">Integrations</h2>
                    <p className="text-sm text-muted-foreground">
                      Connect AgentOps to your existing tools and workflows
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {mockIntegrations.map((integration) => (
                      <Card
                        key={integration.id}
                        className={cn(
                          "border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer",
                          integration.status === "error" && "border-red-500/30"
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                                <IntegrationIcon type={integration.type} />
                              </div>
                              <div>
                                <div className="font-medium">{integration.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {integration.config?.channel || integration.config?.recipients || integration.type}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {integration.status === "connected" && (
                                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  Connected
                                </span>
                              )}
                              {integration.status === "disconnected" && (
                                <span className="text-xs text-muted-foreground">
                                  Not connected
                                </span>
                              )}
                              {integration.status === "error" && (
                                <span className="flex items-center gap-1.5 text-xs text-red-400">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Error
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            {integration.status === "connected" ? (
                              <>
                                <Button variant="outline" size="sm" className="flex-1">
                                  Configure
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                >
                                  Disconnect
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" className="flex-1">
                                Connect
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Billing Tab */}
              {activeTab === "billing" && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-lg font-medium">Billing & Usage</h2>
                    <p className="text-sm text-muted-foreground">
                      Manage your subscription and view usage
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-zinc-800">
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground mb-1">Current Plan</div>
                        <div className="text-2xl font-semibold">Pro</div>
                        <div className="text-sm text-muted-foreground mt-1">$500/month</div>
                      </CardContent>
                    </Card>
                    <Card className="border-zinc-800">
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground mb-1">Executions This Month</div>
                        <div className="text-2xl font-semibold">47,832</div>
                        <div className="text-sm text-muted-foreground mt-1">of 100,000 included</div>
                      </CardContent>
                    </Card>
                    <Card className="border-zinc-800">
                      <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground mb-1">Next Billing Date</div>
                        <div className="text-2xl font-semibold">Mar 15</div>
                        <div className="text-sm text-muted-foreground mt-1">$500.00 due</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-base">Usage Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span>Executions</span>
                            <span className="text-muted-foreground">47,832 / 100,000</span>
                          </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: "47.8%" }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span>API Calls</span>
                            <span className="text-muted-foreground">234,567 / 500,000</span>
                          </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: "46.9%" }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span>Data Retention</span>
                            <span className="text-muted-foreground">12.4 GB / 50 GB</span>
                          </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: "24.8%" }} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-3">
                    <Button variant="outline">View Invoices</Button>
                    <Button variant="outline">Update Payment Method</Button>
                    <Button>Upgrade Plan</Button>
                  </div>
                </div>
              )}

              {/* Organization Tab */}
              {activeTab === "organization" && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-lg font-medium">Organization Settings</h2>
                    <p className="text-sm text-muted-foreground">
                      Manage your organization details and preferences
                    </p>
                  </div>

                  <Card className="border-zinc-800">
                    <CardContent className="p-6 space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Organization Name</label>
                          <input
                            type="text"
                            defaultValue="Acme Corp"
                            className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Organization Slug</label>
                          <input
                            type="text"
                            defaultValue="acme-corp"
                            className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Default Environment</label>
                        <select className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                          <option>Production</option>
                          <option>Staging</option>
                          <option>Development</option>
                        </select>
                      </div>

                      <div className="pt-4 border-t border-zinc-800">
                        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          Security Settings
                        </h3>
                        <div className="space-y-3">
                          <label className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium">Require 2FA for all members</div>
                              <div className="text-xs text-muted-foreground">Enforce two-factor authentication</div>
                            </div>
                            <input type="checkbox" className="h-4 w-4 rounded" defaultChecked />
                          </label>
                          <label className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium">IP Allowlist</div>
                              <div className="text-xs text-muted-foreground">Restrict API access to specific IPs</div>
                            </div>
                            <input type="checkbox" className="h-4 w-4 rounded" />
                          </label>
                          <label className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium">Audit Logging</div>
                              <div className="text-xs text-muted-foreground">Log all team member actions</div>
                            </div>
                            <input type="checkbox" className="h-4 w-4 rounded" defaultChecked />
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline">Cancel</Button>
                        <Button>Save Changes</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-red-500/30">
                    <CardHeader>
                      <CardTitle className="text-base text-red-400">Danger Zone</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">Delete Organization</div>
                          <div className="text-xs text-muted-foreground">
                            Permanently delete this organization and all its data
                          </div>
                        </div>
                        <Button variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/10">
                          Delete Organization
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
