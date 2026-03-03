"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CircularProgress } from "@/components/ui/circular-progress";
import { cn } from "@/lib/utils";
import { useExecutionTrace, useAgents } from "@/lib/hooks";
import type { Agent } from "@/lib/types";
import {
  ArrowLeft,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  ExternalLink,
  MessageSquare,
  Wrench,
  Brain,
  AlertTriangle,
  Database,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

// ============================================================================
// TYPES
// ============================================================================

type EventType = "llm_call" | "tool_call" | "planning" | "error" | "memory";

interface TimelineEvent {
  id: string;
  type: EventType;
  name: string;
  start_ms: number;
  duration_ms: number;
  cost_usd?: number;
  // LLM Call specific
  model?: string;
  provider?: "openai" | "anthropic" | "google" | "mistral";
  input_tokens?: number;
  output_tokens?: number;
  temperature?: number;
  max_tokens?: number;
  input_messages?: { role: string; content: string }[];
  output?: string;
  // Tool Call specific
  tool_input?: Record<string, unknown>;
  tool_output?: Record<string, unknown>;
  success?: boolean;
  // Error specific
  error_message?: string;
  stack_trace?: string;
  // Planning specific
  reasoning?: string;
  decision?: string;
}

interface ExecutionData {
  id: string;
  agent_id: string;
  agent_name: string;
  status: "running" | "completed" | "failed";
  total_duration_ms: number;
  total_cost_usd: number;
  quality_score: number;
  started_at: string;
  ended_at?: string;
  events: TimelineEvent[];
  ai_analysis: {
    root_cause: string;
    recommendation: string;
    confidence: number;
    scores: {
      goal_completion: number;
      reasoning: number;
      tool_usage: number;
      safety: number;
    };
  };
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockExecution: ExecutionData = {
  id: "exec-001",
  agent_id: "agent-001",
  agent_name: "Customer Support Bot",
  status: "completed",
  total_duration_ms: 4250,
  total_cost_usd: 0.0347,
  quality_score: 87,
  started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  ended_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  events: [
    {
      id: "evt-001",
      type: "planning",
      name: "Initial Planning",
      start_ms: 0,
      duration_ms: 120,
      reasoning: "User requested help with account billing issue. Need to verify account status and retrieve recent transactions.",
      decision: "Will first check account status, then pull transaction history.",
    },
    {
      id: "evt-002",
      type: "llm_call",
      name: "Intent Classification",
      start_ms: 120,
      duration_ms: 450,
      cost_usd: 0.0023,
      model: "gpt-4o",
      provider: "openai",
      input_tokens: 256,
      output_tokens: 48,
      temperature: 0.1,
      max_tokens: 100,
      input_messages: [
        { role: "system", content: "You are a customer support classifier. Classify user intents into: billing, technical, account, general." },
        { role: "user", content: "I was charged twice for my subscription last month. Can you help me fix this?" },
      ],
      output: '{"intent": "billing", "confidence": 0.95, "entities": ["duplicate_charge", "subscription"]}',
    },
    {
      id: "evt-003",
      type: "tool_call",
      name: "get_account_info",
      start_ms: 570,
      duration_ms: 180,
      tool_input: { user_id: "usr_12345", fields: ["subscription", "billing_history"] },
      tool_output: {
        subscription: { plan: "Pro", status: "active", amount: 29.99 },
        billing_history: [
          { date: "2024-01-15", amount: 29.99, status: "completed" },
          { date: "2024-01-15", amount: 29.99, status: "completed" },
          { date: "2023-12-15", amount: 29.99, status: "completed" },
        ],
      },
      success: true,
    },
    {
      id: "evt-004",
      type: "llm_call",
      name: "Issue Analysis",
      start_ms: 750,
      duration_ms: 680,
      cost_usd: 0.0089,
      model: "gpt-4o",
      provider: "openai",
      input_tokens: 512,
      output_tokens: 256,
      temperature: 0.3,
      max_tokens: 500,
      input_messages: [
        { role: "system", content: "Analyze customer billing issues and suggest resolutions." },
        { role: "user", content: "Customer reports duplicate charge. Account shows two charges on 2024-01-15 for $29.99 each." },
      ],
      output: "Analysis confirms duplicate subscription charge on January 15, 2024. The customer was charged $29.99 twice on the same day. Recommend initiating refund for one charge ($29.99) and adding account credit as goodwill gesture.",
    },
    {
      id: "evt-005",
      type: "memory",
      name: "Store Context",
      start_ms: 1430,
      duration_ms: 45,
    },
    {
      id: "evt-006",
      type: "tool_call",
      name: "initiate_refund",
      start_ms: 1475,
      duration_ms: 320,
      tool_input: { user_id: "usr_12345", transaction_id: "txn_abc123", amount: 29.99, reason: "duplicate_charge" },
      tool_output: { refund_id: "ref_xyz789", status: "processing", eta_days: 3 },
      success: true,
    },
    {
      id: "evt-007",
      type: "tool_call",
      name: "add_account_credit",
      start_ms: 1795,
      duration_ms: 150,
      tool_input: { user_id: "usr_12345", amount: 5.0, reason: "goodwill_duplicate_charge" },
      tool_output: { credit_id: "crd_def456", new_balance: 5.0 },
      success: true,
    },
    {
      id: "evt-008",
      type: "llm_call",
      name: "Response Generation",
      start_ms: 1945,
      duration_ms: 920,
      cost_usd: 0.0145,
      model: "gpt-4o",
      provider: "openai",
      input_tokens: 768,
      output_tokens: 384,
      temperature: 0.7,
      max_tokens: 600,
      input_messages: [
        { role: "system", content: "Generate a friendly, empathetic customer support response." },
        { role: "user", content: "Context: Refund initiated for $29.99, $5 credit added. Generate response for customer." },
      ],
      output: "I completely understand how frustrating it must be to see a duplicate charge on your account! I've looked into this and confirmed that you were indeed charged twice on January 15th.\n\nHere's what I've done to fix this:\n\n1. **Refund Initiated**: I've processed a refund for $29.99. You should see this back in your account within 3-5 business days.\n\n2. **Bonus Credit**: As an apology for this inconvenience, I've also added a $5.00 credit to your account, which will automatically apply to your next billing cycle.\n\nIs there anything else I can help you with today?",
    },
    {
      id: "evt-009",
      type: "planning",
      name: "Final Check",
      start_ms: 2865,
      duration_ms: 85,
      reasoning: "Response generated successfully. All actions completed. Ready to close.",
      decision: "Execution complete, no further actions needed.",
    },
  ],
  ai_analysis: {
    root_cause: "Duplicate payment processing due to network retry during initial transaction. The payment gateway received the initial request but timed out, causing the client to retry and process a second charge.",
    recommendation: "Implement idempotency keys for payment processing to prevent duplicate charges. Add client-side dedupe logic with transaction fingerprinting.",
    confidence: 94,
    scores: {
      goal_completion: 95,
      reasoning: 88,
      tool_usage: 92,
      safety: 100,
    },
  },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const EVENT_CONFIG: Record<EventType, { color: string; bgColor: string; icon: React.ElementType; label: string }> = {
  llm_call: { color: "#6366F1", bgColor: "bg-indigo-500/20", icon: MessageSquare, label: "LLM Call" },
  tool_call: { color: "#10B981", bgColor: "bg-emerald-500/20", icon: Wrench, label: "Tool Call" },
  planning: { color: "#F59E0B", bgColor: "bg-amber-500/20", icon: Brain, label: "Planning" },
  error: { color: "#EF4444", bgColor: "bg-red-500/20", icon: AlertTriangle, label: "Error" },
  memory: { color: "#8B5CF6", bgColor: "bg-purple-500/20", icon: Database, label: "Memory" },
};

const MODEL_CONFIG: Record<string, { color: string; label: string }> = {
  "gpt-4o": { color: "#10A37F", label: "GPT-4o" },
  "gpt-4-turbo": { color: "#10A37F", label: "GPT-4 Turbo" },
  "gpt-3.5-turbo": { color: "#10A37F", label: "GPT-3.5" },
  "claude-3-opus": { color: "#D97706", label: "Claude 3 Opus" },
  "claude-3.5-sonnet": { color: "#D97706", label: "Claude 3.5 Sonnet" },
  "gemini-pro": { color: "#4285F4", label: "Gemini Pro" },
  "mistral-large": { color: "#FF7000", label: "Mistral Large" },
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function ModelBadge({ model }: { model: string }) {
  const config = MODEL_CONFIG[model] || { color: "#888", label: model };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
      style={{ backgroundColor: `${config.color}20`, color: config.color }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
      >
        <span className="text-sm font-medium text-zinc-300">{title}</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>
      {isOpen && <div className="p-4 bg-zinc-950/50">{children}</div>}
    </div>
  );
}

function SyntaxHighlight({ content, language = "json" }: { content: string; language?: string }) {
  // Simple syntax highlighting for JSON
  const highlighted = useMemo(() => {
    if (language === "json") {
      try {
        const formatted = JSON.stringify(JSON.parse(content), null, 2);
        return formatted
          .replace(/"([^"]+)":/g, '<span class="text-purple-400">"$1"</span>:')
          .replace(/: "([^"]+)"/g, ': <span class="text-emerald-400">"$1"</span>')
          .replace(/: (\d+\.?\d*)/g, ': <span class="text-amber-400">$1</span>')
          .replace(/: (true|false)/g, ': <span class="text-blue-400">$1</span>')
          .replace(/: (null)/g, ': <span class="text-zinc-500">$1</span>');
      } catch {
        return content;
      }
    }
    return content;
  }, [content, language]);

  return (
    <pre className="text-xs font-mono leading-relaxed overflow-x-auto p-3 bg-zinc-950 rounded-lg border border-zinc-800">
      <code dangerouslySetInnerHTML={{ __html: highlighted }} />
    </pre>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

// ============================================================================
// TIMELINE COMPONENT
// ============================================================================

function InteractiveTimeline({
  events,
  totalDuration,
  selectedEvent,
  onSelectEvent,
  zoom,
}: {
  events: TimelineEvent[];
  totalDuration: number;
  selectedEvent: TimelineEvent | null;
  onSelectEvent: (event: TimelineEvent) => void;
  zoom: number;
}) {
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);

  const BAR_HEIGHT = 36;
  const LABEL_WIDTH = 180;
  const DURATION_WIDTH = 80;
  const GAP = 8;
  const PADDING = 16;

  const svgHeight = events.length * (BAR_HEIGHT + GAP) + PADDING * 2;
  const timelineWidth = 400 * zoom;

  return (
    <div className="overflow-x-auto">
      <svg
        width={LABEL_WIDTH + timelineWidth + DURATION_WIDTH + PADDING * 3}
        height={svgHeight}
        className="block"
      >
        {/* Time axis */}
        <g transform={`translate(${LABEL_WIDTH + PADDING}, ${PADDING - 8})`}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <g key={pct} transform={`translate(${pct * timelineWidth}, 0)`}>
              <line
                x1={0}
                y1={8}
                x2={0}
                y2={svgHeight - PADDING}
                stroke="#27272a"
                strokeDasharray="4,4"
              />
              <text
                x={0}
                y={0}
                textAnchor="middle"
                className="fill-zinc-500 text-[10px]"
              >
                {formatMs(pct * totalDuration)}
              </text>
            </g>
          ))}
        </g>

        {/* Events */}
        {events.map((event, index) => {
          const config = EVENT_CONFIG[event.type];
          const Icon = config.icon;
          const y = PADDING + index * (BAR_HEIGHT + GAP);
          const barStart = (event.start_ms / totalDuration) * timelineWidth;
          const barWidth = Math.max(4, (event.duration_ms / totalDuration) * timelineWidth);
          const isSelected = selectedEvent?.id === event.id;
          const isHovered = hoveredEvent?.id === event.id;

          return (
            <g
              key={event.id}
              transform={`translate(0, ${y})`}
              onClick={() => onSelectEvent(event)}
              onMouseEnter={() => setHoveredEvent(event)}
              onMouseLeave={() => setHoveredEvent(null)}
              className="cursor-pointer"
              style={{ opacity: selectedEvent && !isSelected ? 0.5 : 1 }}
            >
              {/* Background */}
              <rect
                x={0}
                y={0}
                width={LABEL_WIDTH + timelineWidth + DURATION_WIDTH + PADDING * 3}
                height={BAR_HEIGHT}
                rx={6}
                className={cn(
                  "transition-all duration-150",
                  isSelected ? "fill-zinc-800" : isHovered ? "fill-zinc-850" : "fill-transparent"
                )}
              />

              {/* Icon + Label */}
              <g transform={`translate(${PADDING}, ${BAR_HEIGHT / 2})`}>
                <foreignObject x={0} y={-10} width={20} height={20}>
                  <div className={cn("w-5 h-5 rounded flex items-center justify-center", config.bgColor)}>
                    <Icon className="w-3 h-3" style={{ color: config.color }} />
                  </div>
                </foreignObject>
                <text
                  x={28}
                  y={4}
                  className="fill-zinc-200 text-xs font-medium"
                  style={{ dominantBaseline: "middle" }}
                >
                  {event.name.length > 18 ? event.name.slice(0, 18) + "..." : event.name}
                </text>
              </g>

              {/* Timeline bar */}
              <rect
                x={LABEL_WIDTH + PADDING + barStart}
                y={(BAR_HEIGHT - 12) / 2}
                width={barWidth}
                height={12}
                rx={3}
                fill={config.color}
                className={cn(
                  "transition-all duration-150",
                  isSelected || isHovered ? "opacity-100" : "opacity-80"
                )}
              />

              {/* Duration + Cost */}
              <text
                x={LABEL_WIDTH + timelineWidth + PADDING * 2}
                y={BAR_HEIGHT / 2}
                className="fill-zinc-400 text-[11px] font-mono"
                style={{ dominantBaseline: "middle" }}
              >
                {formatMs(event.duration_ms)}
              </text>
              {event.cost_usd && (
                <text
                  x={LABEL_WIDTH + timelineWidth + PADDING * 2 + 50}
                  y={BAR_HEIGHT / 2}
                  className="fill-emerald-500 text-[11px] font-mono"
                  style={{ dominantBaseline: "middle" }}
                >
                  {formatCost(event.cost_usd)}
                </text>
              )}

              {/* Selection indicator */}
              {isSelected && (
                <rect
                  x={0}
                  y={0}
                  width={3}
                  height={BAR_HEIGHT}
                  rx={1.5}
                  fill={config.color}
                />
              )}
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hoveredEvent && (
          <g transform={`translate(${LABEL_WIDTH + PADDING + (hoveredEvent.start_ms / totalDuration) * timelineWidth + 10}, ${PADDING + events.findIndex(e => e.id === hoveredEvent.id) * (BAR_HEIGHT + GAP) - 40})`}>
            <rect
              x={0}
              y={0}
              width={180}
              height={36}
              rx={6}
              className="fill-zinc-900"
              stroke="#3f3f46"
            />
            <text x={10} y={16} className="fill-zinc-200 text-xs font-medium">
              {hoveredEvent.name}
            </text>
            <text x={10} y={28} className="fill-zinc-500 text-[10px]">
              {formatMs(hoveredEvent.start_ms)} → {formatMs(hoveredEvent.start_ms + hoveredEvent.duration_ms)}
              {hoveredEvent.cost_usd && ` • ${formatCost(hoveredEvent.cost_usd)}`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// EVENT INSPECTOR COMPONENT
// ============================================================================

function EventInspector({ event }: { event: TimelineEvent | null }) {
  if (!event) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select an event from the timeline</p>
          <p className="text-xs text-zinc-600 mt-1">to view detailed information</p>
        </div>
      </div>
    );
  }

  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  // Generate curl command for LLM calls
  const generateCurl = () => {
    if (event.type !== "llm_call" || !event.input_messages) return "";
    return `curl https://api.openai.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -d '{
    "model": "${event.model}",
    "temperature": ${event.temperature},
    "max_tokens": ${event.max_tokens},
    "messages": ${JSON.stringify(event.input_messages, null, 4).split('\n').join('\n    ')}
  }'`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", config.bgColor)}>
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100">{event.name}</h3>
            <p className="text-xs text-zinc-500">{config.label} • {formatMs(event.duration_ms)}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* LLM Call Details */}
        {event.type === "llm_call" && (
          <>
            {/* Model badge */}
            {event.model && (
              <div className="flex items-center gap-3">
                <ModelBadge model={event.model} />
                <span className="text-xs text-zinc-500">
                  T={event.temperature} • max={event.max_tokens}
                </span>
              </div>
            )}

            {/* Cost breakdown */}
            {event.cost_usd && (
              <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="text-xs text-zinc-500 mb-2">Cost Breakdown</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-400">{event.input_tokens?.toLocaleString()} in</span>
                  <span className="text-zinc-600">×</span>
                  <span className="text-zinc-400">{event.output_tokens?.toLocaleString()} out</span>
                  <span className="text-zinc-600">=</span>
                  <span className="text-emerald-400 font-semibold">{formatCost(event.cost_usd)}</span>
                </div>
              </div>
            )}

            {/* Input messages */}
            {event.input_messages && (
              <CollapsibleSection title="Input Messages" defaultOpen>
                <div className="space-y-3">
                  {event.input_messages.map((msg, i) => (
                    <div key={i} className="space-y-1">
                      <div className={cn(
                        "text-[10px] uppercase tracking-wider font-semibold",
                        msg.role === "system" ? "text-purple-400" :
                        msg.role === "user" ? "text-blue-400" : "text-emerald-400"
                      )}>
                        {msg.role}
                      </div>
                      <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap bg-zinc-950 rounded p-2 border border-zinc-800">
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Output */}
            {event.output && (
              <CollapsibleSection title="Output" defaultOpen>
                <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {event.output}
                </div>
              </CollapsibleSection>
            )}

            {/* Copy as curl */}
            <div className="pt-2">
              <CopyButton text={generateCurl()} label="Copy as curl" />
            </div>
          </>
        )}

        {/* Tool Call Details */}
        {event.type === "tool_call" && (
          <>
            {/* Status */}
            <div className="flex items-center gap-3">
              <StatusBadge status={event.success ? "completed" : "failed"} />
              <span className="text-xs text-zinc-500">{formatMs(event.duration_ms)}</span>
            </div>

            {/* Duration bar */}
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  event.success ? "bg-emerald-500" : "bg-red-500"
                )}
                style={{ width: "100%" }}
              />
            </div>

            {/* Input */}
            {event.tool_input && (
              <CollapsibleSection title="Input" defaultOpen>
                <SyntaxHighlight content={JSON.stringify(event.tool_input)} />
              </CollapsibleSection>
            )}

            {/* Output */}
            {event.tool_output && (
              <CollapsibleSection title="Output" defaultOpen>
                <SyntaxHighlight content={JSON.stringify(event.tool_output)} />
              </CollapsibleSection>
            )}
          </>
        )}

        {/* Planning Details */}
        {event.type === "planning" && (
          <>
            {event.reasoning && (
              <div className="space-y-1">
                <div className="text-xs text-zinc-500 font-medium">Reasoning</div>
                <div className="text-sm text-zinc-300 leading-relaxed">
                  {event.reasoning}
                </div>
              </div>
            )}
            {event.decision && (
              <div className="space-y-1">
                <div className="text-xs text-zinc-500 font-medium">Decision</div>
                <div className="text-sm text-amber-400 leading-relaxed">
                  {event.decision}
                </div>
              </div>
            )}
          </>
        )}

        {/* Error Details */}
        {event.type === "error" && (
          <>
            {event.error_message && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="text-xs text-red-400 font-medium mb-1">Error Message</div>
                <div className="text-sm text-red-300">{event.error_message}</div>
              </div>
            )}
            {event.stack_trace && (
              <CollapsibleSection title="Stack Trace">
                <pre className="text-xs font-mono text-zinc-400 overflow-x-auto">
                  {event.stack_trace}
                </pre>
              </CollapsibleSection>
            )}
          </>
        )}

        {/* Memory Details */}
        {event.type === "memory" && (
          <div className="text-sm text-zinc-400">
            Memory operation completed in {formatMs(event.duration_ms)}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AI ANALYSIS COMPONENT
// ============================================================================

function AIAnalysis({ analysis }: { analysis: ExecutionData["ai_analysis"] }) {
  const radarData = [
    { subject: "Goal", value: analysis.scores.goal_completion, fullMark: 100 },
    { subject: "Reasoning", value: analysis.scores.reasoning, fullMark: 100 },
    { subject: "Tools", value: analysis.scores.tool_usage, fullMark: 100 },
    { subject: "Safety", value: analysis.scores.safety, fullMark: 100 },
  ];

  return (
    <div className="border-t border-zinc-800 bg-zinc-900/30">
      <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-zinc-200">AI Analysis</span>
        <span className="ml-auto text-xs text-zinc-500">
          {analysis.confidence}% confidence
        </span>
      </div>
      <div className="p-5 space-y-4">
        {/* Root cause */}
        <div>
          <div className="text-xs text-zinc-500 font-medium mb-2">Root Cause</div>
          <div className="text-sm text-zinc-300 leading-relaxed">
            {analysis.root_cause}
          </div>
        </div>

        {/* Radar chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#3f3f46" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: "#52525b", fontSize: 9 }}
                tickCount={5}
              />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Recommendation */}
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <div className="text-xs text-emerald-400 font-medium mb-1">Recommended Fix</div>
          <div className="text-sm text-emerald-300 leading-relaxed">
            {analysis.recommendation}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ExecutionTracePage() {
  const params = useParams();
  const router = useRouter();
  const executionId = params.id as string;

  // Fetch execution data with trace
  const { 
    data: execution, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useExecutionTrace(executionId);

  // Fetch agents to get agent name
  const { data: agents } = useAgents();
  const agentName = useMemo(() => {
    if (!agents || !execution) return execution?.agent_id || "Unknown Agent";
    const agent = agents.find((a: Agent) => a.agent_id === execution.agent_id);
    return agent?.name || execution.agent_id;
  }, [agents, execution]);

  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  // Transform API events to component format
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    if (!execution?.events) return [];
    
    // Calculate start time for relative positioning
    const startTime = execution.events.length > 0 
      ? new Date(execution.events[0].occurred_at).getTime() 
      : 0;
    
    return execution.events.map((event, index) => {
      const eventStart = new Date(event.occurred_at).getTime();
      const start_ms = eventStart - startTime;
      
      // Map event_type to our component's EventType
      let type: EventType = "llm_call";
      if (event.event_type === "tool_call" || event.tool_name) type = "tool_call";
      else if (event.event_type === "planning") type = "planning";
      else if (event.event_type === "error" || event.error) type = "error";
      else if (event.event_type === "memory") type = "memory";
      
      return {
        id: event.id,
        type,
        name: event.name || event.tool_name || event.model_id || `Event ${index + 1}`,
        start_ms,
        duration_ms: event.duration_ms || 0,
        cost_usd: event.cost_usd,
        model: event.model_id,
        provider: event.provider as "openai" | "anthropic" | "google" | "mistral" | undefined,
        input_tokens: event.input_tokens,
        output_tokens: event.output_tokens,
        input_messages: event.input_text ? [{ role: "user", content: event.input_text }] : undefined,
        output: event.output_text,
        tool_input: event.tool_args,
        tool_output: event.tool_result,
        success: event.status === "completed",
        error_message: event.error,
      };
    });
  }, [execution]);

  // Calculate total duration from events
  const totalDuration = useMemo(() => {
    if (timelineEvents.length === 0) return 0;
    return Math.max(...timelineEvents.map(e => e.start_ms + e.duration_ms));
  }, [timelineEvents]);

  // Generate AI analysis from execution data 
  const aiAnalysis = useMemo(() => {
    if (!execution) return {
      root_cause: "Analysis pending...",
      recommendation: "Load execution data to see analysis",
      confidence: 0,
      scores: { goal_completion: 0, reasoning: 0, tool_usage: 0, safety: 100 }
    };

    const hasError = execution.status === "failed" || execution.error;
    const qualityScore = execution.quality_score || 75;
    
    return {
      root_cause: hasError 
        ? execution.error || "Execution encountered an error during processing"
        : "Execution completed successfully with all steps processed",
      recommendation: hasError
        ? "Review error logs and retry with corrected parameters"
        : "No immediate actions required. Consider optimizing token usage for cost efficiency.",
      confidence: qualityScore,
      scores: {
        goal_completion: qualityScore,
        reasoning: Math.min(100, qualityScore + 5),
        tool_usage: execution.tool_calls_count > 0 ? Math.min(100, qualityScore + 3) : 50,
        safety: 100,
      }
    };
  }, [execution]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-zinc-950">
        <div className="flex-shrink-0 h-14 px-4 flex items-center border-b border-zinc-800 bg-zinc-900/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/executions")}
            className="gap-2 text-zinc-400 hover:text-zinc-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mx-auto mb-3" />
            <p className="text-zinc-400">Loading execution trace...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !execution) {
    return (
      <div className="h-screen flex flex-col bg-zinc-950">
        <div className="flex-shrink-0 h-14 px-4 flex items-center border-b border-zinc-800 bg-zinc-900/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/executions")}
            className="gap-2 text-zinc-400 hover:text-zinc-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-zinc-200 font-medium mb-1">Failed to load execution</p>
            <p className="text-zinc-500 text-sm mb-4">{error?.message || "Execution not found"}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-3 h-3" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Top Bar */}
      <div className="flex-shrink-0 h-14 px-4 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/executions")}
            className="gap-2 text-zinc-400 hover:text-zinc-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="h-6 w-px bg-zinc-800" />
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-zinc-100">
              {agentName}
            </h1>
            <code className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
              {execution.execution_id}
            </code>
            <StatusBadge status={execution.status} />
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="text-zinc-500">
              Duration:{" "}
              <span className="text-zinc-200 font-medium">
                {formatMs(execution.duration_ms)}
              </span>
            </div>
            <div className="text-zinc-500">
              Cost:{" "}
              <span className="text-emerald-400 font-medium">
                {formatCost(execution.total_cost_usd)}
              </span>
            </div>
            <CircularProgress
              value={execution.quality_score || 0}
              size={36}
              strokeWidth={3}
            />
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 bg-zinc-900 border-zinc-700">
              <Download className="w-3 h-3" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="gap-2 bg-zinc-900 border-zinc-700">
              <ExternalLink className="w-3 h-3" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Timeline */}
        <div className="w-[65%] border-r border-zinc-800 flex flex-col">
          {/* Timeline Header */}
          <div className="flex-shrink-0 px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold text-zinc-200">Execution Timeline</h2>
              <div className="flex items-center gap-3">
                {Object.entries(EVENT_CONFIG).map(([type, config]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-[10px] text-zinc-500">{config.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                className="h-7 w-7 p-0"
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomReset}
                className="h-7 px-2 text-xs"
              >
                {Math.round(zoom * 100)}%
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                className="h-7 w-7 p-0"
                disabled={zoom >= 3}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <div className="w-px h-4 bg-zinc-700 mx-1" />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Timeline Content */}
          <div className="flex-1 overflow-y-auto p-5">
            <InteractiveTimeline
              events={timelineEvents}
              totalDuration={totalDuration}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
              zoom={zoom}
            />
          </div>
        </div>

        {/* Right Panel - Inspector */}
        <div className="w-[35%] flex flex-col min-h-0">
          {/* Event Inspector */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <EventInspector event={selectedEvent} />
          </div>

          {/* AI Analysis */}
          <AIAnalysis analysis={aiAnalysis} />
        </div>
      </div>
    </div>
  );
}
