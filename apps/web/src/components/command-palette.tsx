"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  X, 
  ArrowRight,
  Activity, 
  Bot, 
  AlertTriangle, 
  Bell, 
  DollarSign, 
  Settings, 
  BarChart3, 
  Shield,
  Home,
  Play,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockExecutions, mockAgentHealth, mockIncidents } from "@/lib/mock-data";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  type: string;
  path: string;
}

const pages: SearchResult[] = [
  { id: "page-home", title: "Dashboard", subtitle: "Overview and key metrics", icon: Home, iconColor: "text-[hsl(var(--accent-primary))]", type: "Page", path: "/" },
  { id: "page-executions", title: "Executions", subtitle: "View all agent executions", icon: Activity, iconColor: "text-[hsl(var(--accent-primary))]", type: "Page", path: "/executions" },
  { id: "page-agents", title: "Agents", subtitle: "Manage your AI agents", icon: Bot, iconColor: "text-[hsl(var(--success))]", type: "Page", path: "/agents" },
  { id: "page-incidents", title: "Incidents", subtitle: "View active and resolved incidents", icon: AlertTriangle, iconColor: "text-[hsl(var(--error))]", type: "Page", path: "/incidents" },
  { id: "page-alerts", title: "Alerts", subtitle: "Configure alert rules", icon: Bell, iconColor: "text-[hsl(var(--warning))]", type: "Page", path: "/alerts" },
  { id: "page-costs", title: "Costs", subtitle: "Track LLM spending and usage", icon: DollarSign, iconColor: "text-[hsl(var(--success))]", type: "Page", path: "/costs" },
  { id: "page-performance", title: "Performance", subtitle: "Latency and throughput metrics", icon: BarChart3, iconColor: "text-[hsl(var(--accent-primary))]", type: "Page", path: "/performance" },
  { id: "page-compliance", title: "Compliance", subtitle: "Audit logs and compliance reports", icon: Shield, iconColor: "text-[hsl(var(--text-secondary))]", type: "Page", path: "/compliance" },
  { id: "page-settings", title: "Settings", subtitle: "Configure your workspace", icon: Settings, iconColor: "text-[hsl(var(--text-secondary))]", type: "Page", path: "/settings" },
  { id: "page-live", title: "Live Feed", subtitle: "Real-time execution stream", icon: Play, iconColor: "text-[hsl(var(--error))]", type: "Page", path: "/live-feed" },
  { id: "page-landing", title: "Landing Page", subtitle: "Marketing page", icon: Sparkles, iconColor: "text-[hsl(var(--accent-secondary))]", type: "Page", path: "/landing" },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Build search results from mock data + pages
  const getSearchResults = useCallback((): SearchResult[] => {
    if (!query.trim()) {
      // Return recent/suggested items when empty
      return pages.slice(0, 6);
    }

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search pages
    pages.forEach(page => {
      if (page.title.toLowerCase().includes(lowerQuery) || 
          page.subtitle.toLowerCase().includes(lowerQuery)) {
        results.push(page);
      }
    });

    // Search executions
    mockExecutions.forEach(exec => {
      if (exec.id.toLowerCase().includes(lowerQuery) || 
          exec.agent_name.toLowerCase().includes(lowerQuery) ||
          exec.input.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: `exec-${exec.id}`,
          title: exec.id,
          subtitle: `${exec.agent_name} · ${exec.input.substring(0, 50)}...`,
          icon: Activity,
          iconColor: exec.status === "completed" ? "text-[hsl(var(--success))]" : 
                     exec.status === "failed" ? "text-[hsl(var(--error))]" : 
                     "text-[hsl(var(--warning))]",
          type: "Execution",
          path: `/executions/${exec.id}`,
        });
      }
    });

    // Search agents
    mockAgentHealth.forEach(agent => {
      if (agent.name.toLowerCase().includes(lowerQuery) || 
          agent.framework.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: `agent-${agent.id}`,
          title: agent.name,
          subtitle: `${agent.framework} · ${agent.status}`,
          icon: Bot,
          iconColor: agent.status === "active" ? "text-[hsl(var(--success))]" : 
                     "text-[hsl(var(--text-muted))]",
          type: "Agent",
          path: `/agents`,
        });
      }
    });

    // Search incidents
    mockIncidents.forEach(incident => {
      if (incident.title.toLowerCase().includes(lowerQuery) || 
          incident.id.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: `incident-${incident.id}`,
          title: incident.title,
          subtitle: `${incident.severity} · ${incident.status}`,
          icon: AlertTriangle,
          iconColor: incident.severity === "critical" ? "text-[hsl(var(--error))]" : 
                     "text-[hsl(var(--warning))]",
          type: "Incident",
          path: `/incidents/${incident.id}`,
        });
      }
    });

    return results.slice(0, 10);
  }, [query]);

  const results = getSearchResults();

  // Handle keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigateTo(results[selectedIndex].path);
    }
  }, [results, selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const navigateTo = (path: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(path);
  };

  const close = () => {
    setIsOpen(false);
    setQuery("");
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[600px] z-50">
        <div className="bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-default))] rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border-subtle))]">
            <Search className="w-5 h-5 text-[hsl(var(--text-muted))] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, executions, agents, incidents..."
              className="flex-1 bg-transparent border-none outline-none text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-muted))]"
            />
            <button
              onClick={close}
              className="p-1 hover:bg-[hsl(var(--bg-hover))] rounded transition-colors"
            >
              <X className="w-4 h-4 text-[hsl(var(--text-muted))]" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {results.length === 0 ? (
              <div className="p-8 text-center">
                <Search className="w-10 h-10 text-[hsl(var(--text-muted))] mx-auto mb-3" />
                <p className="text-sm text-[hsl(var(--text-muted))]">No results found for "{query}"</p>
              </div>
            ) : (
              <div className="space-y-1">
                {!query && (
                  <div className="px-3 py-1.5 text-xs font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                    Quick Actions
                  </div>
                )}
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => navigateTo(result.path)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors",
                      index === selectedIndex 
                        ? "bg-[hsl(var(--accent-primary))]/10 text-[hsl(var(--text-primary))]"
                        : "hover:bg-[hsl(var(--bg-hover))] text-[hsl(var(--text-secondary))]"
                    )}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-[hsl(var(--bg-elevated))]", result.iconColor)}>
                      <result.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[hsl(var(--text-primary))] truncate">
                        {result.title}
                      </div>
                      <div className="text-xs text-[hsl(var(--text-muted))] truncate">
                        {result.subtitle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--bg-elevated))] text-[hsl(var(--text-muted))]">
                        {result.type}
                      </span>
                      <ArrowRight className={cn(
                        "w-4 h-4 transition-opacity",
                        index === selectedIndex ? "opacity-100 text-[hsl(var(--accent-primary))]" : "opacity-0"
                      )} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated))] text-xs text-[hsl(var(--text-muted))]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]">↓</kbd>
                <span className="ml-1">to navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]">↵</kbd>
                <span className="ml-1">to select</span>
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]">esc</kbd>
              <span className="ml-1">to close</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
