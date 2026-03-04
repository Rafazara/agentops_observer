"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { mockSettings } from "@/lib/mock-data";
import {
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Users,
  CreditCard,
  ExternalLink,
  AlertTriangle,
  Settings2,
  Globe,
  Zap,
  Crown,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type SettingsTab = "general" | "team" | "api-keys" | "integrations" | "billing";

type TeamRole = "owner" | "admin" | "developer" | "viewer";

interface Integration {
  name: string;
  icon: string;
  connected: boolean;
  detail: string | null;
  since?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "team", label: "Team", icon: Users },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "integrations", label: "Integrations", icon: Globe },
  { id: "billing", label: "Billing", icon: CreditCard },
];

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "UTC",
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
    <button
      onClick={handleCopy}
      className={cn("p-1.5 rounded hover:bg-[hsl(var(--bg-hover))] transition-colors", className)}
    >
      {copied ? (
        <Check className="h-4 w-4 text-[hsl(var(--success))]" />
      ) : (
        <Copy className="h-4 w-4 text-[hsl(var(--text-muted))]" />
      )}
    </button>
  );
}

function RoleBadge({ role }: { role: TeamRole }) {
  const config: Record<TeamRole, { bg: string; text: string }> = {
    owner: { bg: "bg-amber-500/20", text: "text-amber-400" },
    admin: { bg: "bg-blue-500/20", text: "text-blue-400" },
    developer: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
    viewer: { bg: "bg-zinc-500/20", text: "text-zinc-400" },
  };
  const { bg, text } = config[role];
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider", bg, text)}>
      {role}
    </span>
  );
}

function IntegrationIcon({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    slack: <span className="text-xl">💬</span>,
    pagerduty: <span className="text-xl">📟</span>,
    jira: <span className="text-xl">🎫</span>,
    github: <span className="text-xl">🐙</span>,
    datadog: <span className="text-xl">🐕</span>,
    linear: <span className="text-xl">📐</span>,
  };
  return <div className="w-10 h-10 rounded-lg bg-[hsl(var(--bg-surface))] flex items-center justify-center">{icons[icon] || <Globe className="h-5 w-5" />}</div>;
}

function Avatar({ initials, className }: { initials: string; className?: string }) {
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"];
  const colorIndex = initials.charCodeAt(0) % colors.length;
  return (
    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold", colors[colorIndex], className)}>
      {initials}
    </div>
  );
}

// ============================================================================
// TAB CONTENT COMPONENTS
// ============================================================================

function GeneralTab() {
  const { toast } = useToast();
  const [orgName, setOrgName] = useState(mockSettings.organization.name);
  const [timezone, setTimezone] = useState(mockSettings.organization.timezone);
  const [budget, setBudget] = useState(mockSettings.organization.monthlyBudget);
  const [deleteInput, setDeleteInput] = useState("");
  
  const handleSave = () => {
    toast({ type: "success", title: "Settings saved", description: "Organization settings updated successfully" });
  };
  
  const handleDelete = () => {
    if (deleteInput === orgName) {
      toast({ type: "info", title: "Demo Mode", description: "Organization deletion disabled in demo" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card">
        <CardHeader>
          <CardTitle className="text-base">Organization Settings</CardTitle>
          <CardDescription>Manage your organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--text-secondary))]">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="input-field w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--text-secondary))]">Slug</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={mockSettings.organization.slug}
                readOnly
                className="input-field w-full bg-[hsl(var(--bg-hover))] text-[hsl(var(--text-muted))]"
              />
              <CopyButton text={mockSettings.organization.slug} />
            </div>
            <p className="text-xs text-[hsl(var(--text-muted))]">Used in URLs: agentops.ai/{mockSettings.organization.slug}</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--text-secondary))]">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="input-field w-full"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--text-secondary))]">Monthly Budget</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]">$</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="input-field w-full pl-7"
              />
            </div>
          </div>
          
          <Button onClick={handleSave} className="btn-primary">Save Changes</Button>
        </CardContent>
      </Card>
      
      <Card className="card border-[hsl(var(--error))]/30">
        <CardHeader>
          <CardTitle className="text-base text-[hsl(var(--error))] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[hsl(var(--text-muted))]">
            Once you delete an organization, there is no going back. Please be certain.
          </p>
          <div className="space-y-2">
            <label className="text-sm text-[hsl(var(--text-secondary))]">
              Type <strong>{orgName}</strong> to confirm
            </label>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Organization name"
              className="input-field w-full"
            />
          </div>
          <Button
            variant="destructive"
            disabled={deleteInput !== orgName}
            onClick={handleDelete}
            className="bg-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/90"
          >
            Delete Organization
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TeamTab() {
  const { toast } = useToast();
  const [team, setTeam] = useState(mockSettings.team);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("developer");
  
  const handleInvite = () => {
    if (inviteEmail) {
      toast({ type: "success", title: "Invitation sent!", description: `Invite sent to ${inviteEmail}` });
      setShowInvite(false);
      setInviteEmail("");
    }
  };
  
  const handleRemove = (id: string) => {
    setTeam(team.filter(m => m.id !== id));
    toast({ type: "success", title: "Member removed" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-[hsl(var(--text-primary))]">Team Members</h2>
          <p className="text-sm text-[hsl(var(--text-muted))]">{team.length} members</p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="btn-primary gap-2">
          <Plus className="h-4 w-4" />
          Invite Member
        </Button>
      </div>
      
      {showInvite && (
        <Card className="card border-[hsl(var(--primary))]/30">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="input-field flex-1"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="input-field"
              >
                <option value="admin">Admin</option>
                <option value="developer">Developer</option>
                <option value="viewer">Viewer</option>
              </select>
              <Button onClick={handleInvite} className="btn-primary">Send Invite</Button>
              <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className="card">
        <CardContent className="p-0 divide-y divide-[hsl(var(--border-subtle))]">
          {team.map(member => (
            <div key={member.id} className="flex items-center gap-4 p-4">
              <Avatar initials={member.avatar} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[hsl(var(--text-primary))]">{member.name}</p>
                <p className="text-sm text-[hsl(var(--text-muted))] truncate">{member.email}</p>
              </div>
              <RoleBadge role={member.role} />
              <span className="text-xs text-[hsl(var(--text-disabled))]">{member.lastActive}</span>
              {member.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(member.id)}
                  className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--error))]"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ApiKeysTab() {
  const { toast } = useToast();
  const [keys, setKeys] = useState(mockSettings.apiKeys);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  
  const handleCreate = () => {
    if (!newKeyName) return;
    const fakeKey = `agops_sk_live_${Math.random().toString(36).substring(2, 14)}`;
    setGeneratedKey(fakeKey);
    setKeys([{ 
      id: `key_${Date.now()}`, 
      name: newKeyName, 
      prefix: "agops_sk_live_", 
      created: "Just now", 
      lastUsed: "Never", 
      status: "active" as const 
    }, ...keys]);
    setNewKeyName("");
  };
  
  const handleRevoke = (id: string) => {
    if (confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      setKeys(keys.filter(k => k.id !== id));
      toast({ type: "success", title: "API key revoked" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-[hsl(var(--text-primary))]">API Keys</h2>
          <p className="text-sm text-[hsl(var(--text-muted))]">Manage SDK authentication keys</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setGeneratedKey(null); }} className="btn-primary gap-2">
          <Plus className="h-4 w-4" />
          Generate New Key
        </Button>
      </div>
      
      {showCreate && (
        <Card className="card border-[hsl(var(--primary))]/30">
          <CardContent className="p-4 space-y-4">
            {!generatedKey ? (
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="Key name (e.g., Production SDK)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="input-field flex-1"
                />
                <Button onClick={handleCreate} className="btn-primary">Generate Key</Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/30 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
                  <span className="text-sm text-[hsl(var(--warning))]">Save this key — it will only be shown once</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-[hsl(var(--bg-surface))] rounded-lg font-mono text-sm">
                  <code className="flex-1 break-all">{generatedKey}</code>
                  <CopyButton text={generatedKey} />
                </div>
                <Button onClick={() => setShowCreate(false)} className="btn-primary">Done</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <Card className="card">
        <CardContent className="p-0 divide-y divide-[hsl(var(--border-subtle))]">
          {keys.map(key => (
            <div key={key.id} className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-[hsl(var(--primary))]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[hsl(var(--text-primary))]">{key.name}</p>
                <p className="text-sm text-[hsl(var(--text-muted))] font-mono">{key.prefix}****</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[hsl(var(--text-secondary))]">Created {key.created}</p>
                <p className="text-xs text-[hsl(var(--text-muted))]">Last used {key.lastUsed}</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/20 text-emerald-400">
                {key.status}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRevoke(key.id)}
                className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--error))]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationsTab() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>(mockSettings.integrations as Integration[]);
  
  const handleConnect = (name: string) => {
    toast({ type: "info", title: "Demo Mode", description: `Opens OAuth flow in production for ${name}` });
  };
  
  const handleDisconnect = (name: string) => {
    setIntegrations(integrations.map(i => 
      i.name === name ? { ...i, connected: false, detail: null } : i
    ));
    toast({ type: "success", title: `${name} disconnected` });
  };
  
  const handleTestSlack = () => {
    toast({ type: "success", title: "Test alert sent!", description: "Check #ai-alerts channel" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-[hsl(var(--text-primary))]">Integrations</h2>
        <p className="text-sm text-[hsl(var(--text-muted))]">Connect external services for alerts and ticketing</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(integration => (
          <Card key={integration.name} className="card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <IntegrationIcon icon={integration.icon} />
                {integration.connected ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/20 text-emerald-400">
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-zinc-500/20 text-zinc-400">
                    Not Connected
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-[hsl(var(--text-primary))]">{integration.name}</p>
                {integration.connected && integration.detail && (
                  <p className="text-sm text-[hsl(var(--text-muted))]">{integration.detail}</p>
                )}
                {integration.connected && integration.since && (
                  <p className="text-xs text-[hsl(var(--text-disabled))]">Since {integration.since}</p>
                )}
              </div>
              <div className="flex gap-2">
                {integration.connected ? (
                  <>
                    {integration.name === "Slack" && (
                      <Button variant="outline" size="sm" onClick={handleTestSlack}>
                        Test Alert
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(integration.name)}
                      className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--error))]"
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect(integration.name)}
                    className="gap-1"
                  >
                    Connect
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BillingTab() {
  const { toast } = useToast();
  const billing = mockSettings.billing;
  
  const usageColor = billing.usagePercent < 70 
    ? "bg-[hsl(var(--success))]" 
    : billing.usagePercent < 90 
      ? "bg-[hsl(var(--warning))]" 
      : "bg-[hsl(var(--error))]";
  
  const handleUpgrade = () => {
    toast({ type: "info", title: "Demo Mode", description: "Upgrade available in production" });
  };
  
  const handleUpdateCard = () => {
    toast({ type: "info", title: "Demo Mode", description: "Payment method update available in production" });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-[hsl(var(--warning))]" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[hsl(var(--text-primary))]">${billing.price}</span>
              <span className="text-[hsl(var(--text-muted))]">/month</span>
            </div>
            <p className="text-[hsl(var(--primary))] font-medium">{billing.plan}</p>
            <p className="text-sm text-[hsl(var(--text-muted))]">Next billing date: {billing.billingDate}</p>
          </CardContent>
        </Card>
        
        <Card className="card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-[hsl(var(--chart-3))]" />
              Usage This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[hsl(var(--text-primary))]">{billing.eventsUsed}</span>
              <span className="text-sm text-[hsl(var(--text-muted))]">/ {billing.eventsLimit} events</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[hsl(var(--bg-hover))]">
              <div
                className={cn("h-full rounded-full transition-all", usageColor)}
                style={{ width: `${billing.usagePercent}%` }}
              />
            </div>
            <p className="text-sm text-[hsl(var(--text-muted))]">{billing.usagePercent}% of monthly limit</p>
          </CardContent>
        </Card>
      </div>
      
      <Card className="card">
        <CardHeader>
          <CardTitle className="text-base">Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-6 rounded bg-gradient-to-r from-blue-600 to-blue-400" />
            <span className="text-[hsl(var(--text-primary))]">Visa ending in {billing.cardLast4}</span>
          </div>
          <Button variant="outline" onClick={handleUpdateCard}>Update Card</Button>
        </CardContent>
      </Card>
      
      <Card className="card">
        <CardHeader>
          <CardTitle className="text-base">Plan Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg border border-[hsl(var(--border-subtle))]">
              <p className="font-semibold">Starter</p>
              <p className="text-2xl font-bold">$99</p>
              <p className="text-[hsl(var(--text-muted))]">5M events/mo</p>
            </div>
            <div className="p-4 rounded-lg border-2 border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5">
              <p className="font-semibold text-[hsl(var(--primary))]">Professional ✓</p>
              <p className="text-2xl font-bold">${billing.price}</p>
              <p className="text-[hsl(var(--text-muted))]">{billing.eventsLimit} events/mo</p>
            </div>
            <div className="p-4 rounded-lg border border-[hsl(var(--border-subtle))]">
              <p className="font-semibold">Enterprise</p>
              <p className="text-2xl font-bold">Custom</p>
              <p className="text-[hsl(var(--text-muted))]">Unlimited</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Button onClick={handleUpgrade} className="btn-primary w-full md:w-auto gap-2" size="lg">
        <Crown className="h-4 w-4" />
        Upgrade to Enterprise
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  return (
    <div className="flex h-screen bg-[hsl(var(--bg-base))]">
      <PageTitle title="Settings" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
            {/* Page header */}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--text-primary))]">Settings</h1>
              <p className="text-sm text-[hsl(var(--text-muted))]">
                Manage your organization, team, and integrations
              </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-[hsl(var(--border-default))] pb-px overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 -mb-px",
                    activeTab === tab.id
                      ? "border-[hsl(var(--primary))] text-[hsl(var(--text-primary))] bg-[hsl(var(--primary))]/5"
                      : "border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-hover))]"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "team" && <TeamTab />}
              {activeTab === "api-keys" && <ApiKeysTab />}
              {activeTab === "integrations" && <IntegrationsTab />}
              {activeTab === "billing" && <BillingTab />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
