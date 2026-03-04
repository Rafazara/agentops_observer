/**
 * Rich Mock Data for AgentOps Observer
 * 
 * This data makes the product look impressive in demos.
 * Used when API is unavailable or in demo mode.
 */

// ============================================================================
// DASHBOARD MOCK DATA
// ============================================================================

export const mockDashboardStats = {
  activeAgents: 5,
  runningNow: 2,
  idleAgents: 3,
  executionsToday: 1247,
  successRate: 94.3,
  successRateChange: 2.1,
  costToday: 24.73,
  costMonth: 743.20,
  budgetUsed: 74,
  openIncidents: 2,
  criticalIncidents: 1,
  // Sparkline data (last 7 days)
  executionSparkline: [89, 134, 156, 203, 178, 234, 189],
  costSparkline: [18.2, 22.1, 19.8, 28.4, 21.3, 31.2, 24.7],
};

export const mockAgentHealth = [
  {
    id: "customer-support-v2",
    name: "Customer Support",
    version: "v2.3",
    framework: "LangChain",
    status: "active" as const,
    healthScore: 94,
    lastExecution: "2 minutes ago",
    lastStatus: "success" as const,
    costToday: 8.42,
    successRate7d: 96.2,
    sparkline: [1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
    totalExecutions: 412,
    avgDuration: 1240,
  },
  {
    id: "lead-qualifier",
    name: "Lead Qualifier",
    version: "v1.8",
    framework: "OpenAI",
    status: "active" as const,
    healthScore: 88,
    lastExecution: "5 minutes ago",
    lastStatus: "success" as const,
    costToday: 5.21,
    successRate7d: 91.4,
    sparkline: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
    totalExecutions: 287,
    avgDuration: 890,
  },
  {
    id: "invoice-processor",
    name: "Invoice Processor",
    version: "v3.1",
    framework: "Anthropic",
    status: "warning" as const,
    healthScore: 71,
    lastExecution: "12 minutes ago",
    lastStatus: "failed" as const,
    costToday: 4.87,
    successRate7d: 78.9,
    sparkline: [1, 1, 1, 0, 0, 1, 0, 1, 0, 1],
    totalExecutions: 156,
    avgDuration: 2340,
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    version: "v2.0",
    framework: "LangChain",
    status: "idle" as const,
    healthScore: 97,
    lastExecution: "1 hour ago",
    lastStatus: "success" as const,
    costToday: 3.14,
    successRate7d: 98.1,
    sparkline: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    totalExecutions: 89,
    avgDuration: 4120,
  },
  {
    id: "onboarding-assistant",
    name: "Onboarding Assistant",
    version: "v1.5",
    framework: "Anthropic",
    status: "active" as const,
    healthScore: 82,
    lastExecution: "8 minutes ago",
    lastStatus: "success" as const,
    costToday: 3.09,
    successRate7d: 85.3,
    sparkline: [1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    totalExecutions: 203,
    avgDuration: 1560,
  },
];

export const mockExecutionVolume = {
  // Last 24 hours, hourly buckets
  labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
  total: [12, 8, 5, 3, 2, 4, 8, 15, 28, 42, 56, 61, 58, 49, 52, 47, 53, 61, 48, 39, 31, 28, 22, 18],
  success: [11, 8, 5, 3, 2, 4, 8, 14, 26, 40, 53, 58, 55, 46, 50, 44, 51, 58, 45, 37, 29, 26, 21, 17],
  failed: [1, 0, 0, 0, 0, 0, 0, 1, 2, 2, 3, 3, 3, 3, 2, 3, 2, 3, 3, 2, 2, 2, 1, 1],
};

export const mockQualityTrends = {
  // Last 7 days
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  agents: [
    { name: 'Customer Support', data: [94, 92, 95, 91, 96, 93, 94], color: '#4F6EF7' },
    { name: 'Lead Qualifier', data: [88, 91, 87, 89, 90, 88, 88], color: '#22C55E' },
    { name: 'Invoice Processor', data: [78, 75, 71, 73, 70, 72, 71], color: '#F59E0B' },
    { name: 'Data Analyst', data: [97, 98, 96, 97, 98, 97, 97], color: '#EC4899' },
    { name: 'Onboarding', data: [84, 82, 85, 83, 86, 82, 82], color: '#8B5CF6' },
  ],
};

export const mockCostBreakdown = [
  { name: 'CX Automation', value: 8.42, percentage: 34, color: '#4F6EF7' },
  { name: 'Sales Pipeline', value: 5.21, percentage: 21, color: '#22C55E' },
  { name: 'Finance Ops', value: 4.87, percentage: 20, color: '#F59E0B' },
  { name: 'Analytics', value: 3.14, percentage: 13, color: '#EC4899' },
  { name: 'HR & Onboarding', value: 3.09, percentage: 12, color: '#8B5CF6' },
];

export const mockRecentIncidents = [
  {
    id: "inc-001",
    type: "loop_detected",
    severity: "critical" as const,
    title: "Infinite loop detected in invoice-processor",
    agent: "invoice-processor",
    agent_id: "invoice-processor",
    affected_agent: "Invoice Processor",
    project: "Finance Ops",
    detectedAgo: "23 minutes ago",
    created_at: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
    status: "open" as const,
    costImpact: 4.20,
    affectedExecutions: 8,
  },
  {
    id: "inc-002",
    type: "quality_degradation",
    severity: "warning" as const,
    title: "Quality degradation in lead-qualifier v1.8",
    agent: "lead-qualifier",
    agent_id: "lead-qualifier",
    affected_agent: "Lead Qualifier",
    project: "Sales Pipeline",
    detectedAgo: "2 hours ago",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "acknowledged" as const,
    costImpact: 0,
    affectedExecutions: 34,
  },
];

// ============================================================================
// EXECUTIONS MOCK DATA (50 realistic entries)
// ============================================================================

const agentConfigs = [
  {
    agent_id: "customer-support-v2",
    agent_name: "Customer Support",
    tasks: [
      "Help customer with billing issue for order #48291",
      "Resolve shipping delay complaint for customer",
      "Process refund request for damaged product",
      "Answer product feature questions",
      "Handle account access recovery",
    ],
  },
  {
    agent_id: "lead-qualifier",
    agent_name: "Lead Qualifier",
    tasks: [
      "Qualify lead: John Smith, CTO at TechCorp, $2M budget",
      "Assess startup lead: Series A, 50 employees",
      "Score enterprise lead: Fortune 500 company",
      "Evaluate SMB prospect: 10-person team",
      "Process inbound demo request from VP Engineering",
    ],
  },
  {
    agent_id: "invoice-processor",
    agent_name: "Invoice Processor",
    tasks: [
      "Process invoice INV-2024-0847 from Acme Corp $12,400",
      "Validate vendor invoice for software licenses",
      "Extract data from PDF invoice #8492",
      "Match PO-2024-123 with incoming invoice",
      "Process expense report for Q4 travel",
    ],
  },
  {
    agent_id: "data-analyst",
    agent_name: "Data Analyst",
    tasks: [
      "Generate Q4 sales report for LATAM region",
      "Analyze customer churn patterns for Q3",
      "Create revenue forecast for next quarter",
      "Build cohort analysis for new users",
      "Calculate LTV/CAC metrics by segment",
    ],
  },
  {
    agent_id: "onboarding-assistant",
    agent_name: "Onboarding Assistant",
    tasks: [
      "Onboard new user sarah@startup.com to Enterprise plan",
      "Guide team admin through workspace setup",
      "Configure SSO integration for new customer",
      "Set up billing for Growth plan upgrade",
      "Walk through API integration steps",
    ],
  },
];

function generateExecutionId(): string {
  return `exec_${Math.random().toString(36).substring(2, 10)}`;
}

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateMockExecutions(count: number) {
  const executions = [];
  const successCount = Math.floor(count * 0.94); // 94% success rate

  for (let i = 0; i < count; i++) {
    const agentConfig = agentConfigs[i % agentConfigs.length];
    const task = agentConfig.tasks[Math.floor(Math.random() * agentConfig.tasks.length)];
    const isSuccess = i < successCount;
    const status = isSuccess ? "completed" : "failed";

    // Realistic cost distribution: $0.0023 to $2.48
    const cost = isSuccess
      ? randomInRange(0.002, 0.15) + (Math.random() > 0.9 ? randomInRange(0.5, 2.5) : 0)
      : randomInRange(0.001, 0.05);

    // Duration: 200ms to 8000ms
    const duration = Math.floor(randomInRange(200, 8000));

    // Quality score: normally distributed around 87
    const quality = isSuccess
      ? Math.min(100, Math.max(60, Math.floor(87 + (Math.random() - 0.5) * 30)))
      : Math.floor(randomInRange(20, 50));

    // Time spread over last 6 hours
    const minutesAgo = Math.floor(randomInRange(0, 360));
    const startedAt = new Date(Date.now() - minutesAgo * 60 * 1000);

    executions.push({
      id: generateExecutionId(),
      agent_id: agentConfig.agent_id,
      agent_name: agentConfig.agent_name,
      status,
      input: task,
      output: isSuccess ? `Successfully processed: ${task.substring(0, 30)}...` : "Error: Operation failed",
      started_at: startedAt.toISOString(),
      ended_at: new Date(startedAt.getTime() + duration).toISOString(),
      duration_ms: duration,
      total_cost_usd: Math.round(cost * 10000) / 10000,
      quality_score: quality,
      token_count: Math.floor(randomInRange(150, 8000)),
      model: ["gpt-4o", "claude-3.5-sonnet", "gpt-4o-mini", "claude-3-haiku"][Math.floor(Math.random() * 4)],
      error_message: isSuccess ? null : "Timeout exceeded or rate limit hit",
    });
  }

  // Sort by started_at descending (most recent first)
  return executions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
}

export const mockExecutions = generateMockExecutions(50);

// ============================================================================
// EXECUTION TRACE MOCK DATA
// ============================================================================

export const mockExecutionTrace = {
  id: "exec_abc123xy",
  agent_id: "customer-support-v2",
  agent_name: "Customer Support",
  status: "completed" as const,
  input: "Help customer with billing issue for order #48291",
  output: "Successfully resolved billing issue. Refund of $24.99 processed. Customer notified via email.",
  started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  ended_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  duration_ms: 2017,
  total_cost_usd: 0.0084,
  quality_score: 94,
  token_count: 2847,
  model: "gpt-4o",
  events: [
    {
      id: "evt_001",
      event_type: "planning_step",
      timestamp: 0,
      duration_ms: 120,
      data: { step: "Analyzing customer request", plan: "1. Search KB 2. Get order 3. Check billing 4. Resolve" },
    },
    {
      id: "evt_002",
      event_type: "llm_call",
      timestamp: 120,
      duration_ms: 340,
      cost_usd: 0.0023,
      model: "gpt-4o",
      input_tokens: 245,
      output_tokens: 89,
      data: { prompt: "Analyze billing request", response: "Customer needs refund for order #48291" },
    },
    {
      id: "evt_003",
      event_type: "tool_call",
      timestamp: 460,
      duration_ms: 89,
      tool_name: "search_kb",
      data: { query: "billing refund policy", results: 3 },
    },
    {
      id: "evt_004",
      event_type: "llm_call",
      timestamp: 549,
      duration_ms: 280,
      cost_usd: 0.0018,
      model: "gpt-4o",
      input_tokens: 412,
      output_tokens: 156,
      data: { prompt: "Apply refund policy to case", response: "Eligible for full refund under 30-day policy" },
    },
    {
      id: "evt_005",
      event_type: "tool_call",
      timestamp: 829,
      duration_ms: 145,
      tool_name: "get_order",
      data: { order_id: "48291", amount: 24.99, status: "delivered" },
    },
    {
      id: "evt_006",
      event_type: "tool_call",
      timestamp: 974,
      duration_ms: 92,
      tool_name: "check_billing",
      data: { payment_method: "visa_4242", refundable: true },
    },
    {
      id: "evt_007",
      event_type: "llm_call",
      timestamp: 1066,
      duration_ms: 420,
      cost_usd: 0.0031,
      model: "gpt-4o",
      input_tokens: 678,
      output_tokens: 234,
      data: { prompt: "Generate resolution plan", response: "Process refund and send confirmation email" },
    },
    {
      id: "evt_008",
      event_type: "tool_call",
      timestamp: 1486,
      duration_ms: 67,
      tool_name: "update_ticket",
      data: { ticket_id: "TKT-8291", status: "resolved" },
    },
    {
      id: "evt_009",
      event_type: "tool_call",
      timestamp: 1553,
      duration_ms: 234,
      tool_name: "send_email",
      data: { to: "customer@example.com", template: "refund_confirmation" },
    },
    {
      id: "evt_010",
      event_type: "llm_call",
      timestamp: 1787,
      duration_ms: 180,
      cost_usd: 0.0012,
      model: "gpt-4o",
      input_tokens: 123,
      output_tokens: 67,
      data: { prompt: "Summarize resolution", response: "Refund processed successfully" },
    },
    {
      id: "evt_011",
      event_type: "checkpoint",
      timestamp: 1967,
      duration_ms: 5,
      data: { checkpoint: "resolution_complete" },
    },
    {
      id: "evt_012",
      event_type: "planning_step",
      timestamp: 1972,
      duration_ms: 45,
      data: { step: "Execution complete", outcome: "success" },
    },
  ],
};

// ============================================================================
// COSTS MOCK DATA
// ============================================================================

function generateDailyCosts(days: number) {
  const costs = [];
  const baseDaily = 24.5;
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const variation = (Math.random() - 0.5) * 15;
    const cost = Math.max(12, baseDaily + variation);
    
    costs.push({
      date: date.toISOString().split('T')[0],
      cost: Math.round(cost * 100) / 100,
      budget: 30,
      breakdown: {
        gpt4o: Math.round(cost * 0.38 * 100) / 100,
        claude: Math.round(cost * 0.31 * 100) / 100,
        other: Math.round(cost * 0.31 * 100) / 100,
      },
    });
  }
  return costs;
}

export const mockCosts = {
  totalToday: 24.73,
  totalMonth: 743.20,
  budget: 1000,
  budgetUsed: 74,
  projectedMonth: 892.40,
  avgDaily: 24.77,
  dailyCosts: generateDailyCosts(30),
  modelBreakdown: [
    { model: "GPT-4o", cost: 282.42, percentage: 38, color: "hsl(var(--chart-1))" },
    { model: "Claude-3.5-Sonnet", cost: 230.39, percentage: 31, color: "hsl(var(--chart-2))" },
    { model: "Claude-Haiku", cost: 133.78, percentage: 18, color: "hsl(var(--chart-3))" },
    { model: "GPT-4o-mini", cost: 96.61, percentage: 13, color: "hsl(var(--chart-4))" },
  ],
  agentCosts: mockAgentHealth.map((a) => ({
    agent_id: a.id,
    agent_name: a.name,
    cost: a.costToday * 30,
    executions: a.totalExecutions * 30,
    efficiency: a.costToday / a.totalExecutions,
  })),
  treemapData: [
    {
      name: "CX Automation",
      children: [
        { name: "Customer Support", size: 252.60, efficiency: 0.21 },
        { name: "Ticket Router", size: 89.40, efficiency: 0.12 },
      ],
    },
    {
      name: "Sales",
      children: [
        { name: "Lead Qualifier", size: 156.30, efficiency: 0.18 },
        { name: "Demo Scheduler", size: 67.20, efficiency: 0.15 },
      ],
    },
    {
      name: "Finance",
      children: [
        { name: "Invoice Processor", size: 146.10, efficiency: 0.52 },
      ],
    },
  ],
};

// ============================================================================
// INCIDENTS MOCK DATA
// ============================================================================

export const mockIncidents = [
  {
    id: "inc-001",
    incident_type: "infinite_loop",
    type: "loop" as const,
    severity: "critical" as const,
    status: "open" as const,
    title: "Infinite loop detected in invoice-processor",
    description: "Agent entered infinite retry loop processing invoice INV-2024-0892",
    agent_id: "invoice-processor",
    affected_agent: "Invoice Processor",
    project: "Finance Ops",
    created_at: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    cost_impact: 4.20,
    affected_executions: 8,
    ai_analysis: "The agent encountered a malformed PDF that triggered repeated parsing attempts. The retry logic lacks a maximum attempt counter, causing infinite loops. Recommend adding max_retries=3 and implementing circuit breaker pattern.",
  },
  {
    id: "inc-002",
    incident_type: "quality_degradation",
    type: "quality_drop" as const,
    severity: "high" as const,
    status: "acknowledged" as const,
    title: "Quality degradation in lead-qualifier v1.8",
    description: "Quality scores dropped 15% after model update",
    agent_id: "lead-qualifier",
    affected_agent: "Lead Qualifier",
    project: "Sales Pipeline",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    acknowledged_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    resolved_at: null,
    cost_impact: 0,
    affected_executions: 34,
    ai_analysis: "Quality degradation correlates with prompt template update deployed 2 hours ago. The new template is missing key qualification criteria. Recommend rolling back to previous prompt version.",
  },
  {
    id: "inc-003",
    incident_type: "cost_spike",
    type: "cost_spike" as const,
    severity: "warning" as const,
    status: "resolved" as const,
    title: "Cost spike in data-analyst agent",
    description: "Unexpected 3x cost increase for analytics queries",
    agent_id: "data-analyst",
    affected_agent: "Data Analyst",
    project: "Analytics",
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    acknowledged_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    cost_impact: 12.50,
    affected_executions: 15,
    ai_analysis: "Cost spike was caused by inefficient query that retrieved full dataset instead of aggregates. Query has been optimized to use GROUP BY, reducing token usage by 80%.",
  },
  {
    id: "inc-004",
    incident_type: "rate_limit",
    type: "error_rate" as const,
    severity: "warning" as const,
    status: "resolved" as const,
    title: "Rate limit hit on OpenAI API",
    description: "Burst of requests exceeded rate limit",
    agent_id: "customer-support-v2",
    affected_agent: "Customer Support",
    project: "CX Automation",
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    acknowledged_at: new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 46 * 60 * 60 * 1000).toISOString(),
    cost_impact: 0,
    affected_executions: 28,
    ai_analysis: "Traffic spike from marketing campaign exceeded provisioned rate limits. Implemented request queuing with exponential backoff. Consider increasing rate limit tier for peak periods.",
  },
  {
    id: "inc-005",
    incident_type: "latency_spike",
    type: "latency" as const,
    severity: "low" as const,
    status: "resolved" as const,
    title: "Elevated latency on onboarding flows",
    description: "P95 latency increased from 2s to 5s",
    agent_id: "onboarding-assistant",
    affected_agent: "Onboarding Assistant",
    project: "HR & Onboarding",
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    acknowledged_at: new Date(Date.now() - 71 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 68 * 60 * 60 * 1000).toISOString(),
    cost_impact: 0,
    affected_executions: 42,
    ai_analysis: "Latency was caused by cold starts in the embedding service. Implemented keep-alive pings and connection pooling. P95 latency now stable at 1.8s.",
  },
];

export const mockIncidentStats = {
  open_count: 1,
  acknowledged_count: 1,
  resolved_count: 3,
  total_count: 5,
  avg_acknowledge_seconds: 2400,
  avg_resolve_seconds: 14400,
  critical_count: 1,
  high_count: 1,
  warning_count: 2,
  low_count: 1,
};

// ============================================================================
// PERFORMANCE MOCK DATA
// ============================================================================

export const mockPerformance = {
  p50Latency: 847,
  p95Latency: 2340,
  p99Latency: 4120,
  throughput: 52,
  successRate: 94.3,
  totalExecutions: 1247,
  avgDuration: 1456,
  errorRate: 5.7,
  latencyDistribution: [
    { range: "0-500ms", count: 312 },
    { range: "500ms-1s", count: 423 },
    { range: "1-2s", count: 298 },
    { range: "2-5s", count: 178 },
    { range: "5s+", count: 36 },
  ],
  throughputHistory: Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    executions: Math.floor(30 + Math.random() * 40),
    errors: Math.floor(Math.random() * 5),
  })),
  agentPerformance: mockAgentHealth.map((a) => ({
    agent_id: a.id,
    agent_name: a.name,
    p50: Math.floor(400 + Math.random() * 800),
    p95: Math.floor(1500 + Math.random() * 1500),
    p99: Math.floor(3000 + Math.random() * 2000),
    successRate: a.successRate7d,
    executions: a.totalExecutions,
  })),
  errorDistribution: [
    { type: "Timeout", count: 23, percentage: 32 },
    { type: "Rate Limit", count: 18, percentage: 25 },
    { type: "Invalid Input", count: 15, percentage: 21 },
    { type: "Model Error", count: 10, percentage: 14 },
    { type: "Other", count: 6, percentage: 8 },
  ],
};

// ============================================================================
// LIVE FEED MOCK DATA
// ============================================================================

export function generateMockLiveFeedEvent(index: number) {
  const agents = mockAgentHealth;
  const agent = agents[index % agents.length];
  const isSuccess = Math.random() > 0.06; // 94% success rate

  return {
    id: `live_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    execution_id: generateExecutionId(),
    agent_id: agent.id,
    agent_name: agent.name,
    event_type: isSuccess ? "execution_completed" : "execution_failed",
    status: isSuccess ? "completed" : "failed",
    timestamp: new Date().toISOString(),
    duration_ms: Math.floor(randomInRange(200, 3000)),
    cost_usd: Math.round(randomInRange(0.002, 0.05) * 10000) / 10000,
    quality_score: isSuccess ? Math.floor(randomInRange(75, 98)) : null,
    input: agentConfigs.find((c) => c.agent_id === agent.id)?.tasks[0] || "Processing request...",
  };
}

export const mockLiveFeedEvents = Array.from({ length: 20 }, (_, i) => {
  const event = generateMockLiveFeedEvent(i);
  // Spread events over last 5 minutes
  const timestamp = new Date(Date.now() - (20 - i) * 15000);
  return { ...event, timestamp: timestamp.toISOString() };
});

// ============================================================================
// ALERTS MOCK DATA
// ============================================================================

export const mockAlerts = [
  {
    id: "alert-001",
    name: "Cost Spike Alert",
    description: "Alert when daily cost exceeds $35",
    type: "cost_spike",
    enabled: true,
    threshold: 35,
    condition: "cost_daily > 35",
    triggered_count: 2,
    last_triggered: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    channels: ["email", "slack"],
  },
  {
    id: "alert-002",
    name: "Quality Degradation Alert",
    description: "Alert when quality score drops below 80%",
    type: "quality_drop",
    enabled: true,
    threshold: 80,
    condition: "quality_score < 80",
    triggered_count: 0,
    last_triggered: null,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    channels: ["email"],
  },
  {
    id: "alert-003",
    name: "Loop Detection Alert",
    description: "Alert on potential infinite loops",
    type: "loop_detection",
    enabled: true,
    threshold: 10,
    condition: "repeated_calls > 10",
    triggered_count: 1,
    last_triggered: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    channels: ["email", "slack", "pagerduty"],
  },
  {
    id: "alert-004",
    name: "Daily Budget Alert",
    description: "Alert when daily spend approaches budget",
    type: "budget_warning",
    enabled: true,
    threshold: 30,
    condition: "cost_daily > 30",
    triggered_count: 1,
    last_triggered: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    channels: ["slack"],
  },
];

// ============================================================================
// AGENTS EXTENDED MOCK DATA
// ============================================================================

export const mockAgentsExtended = mockAgentHealth.map((agent) => ({
  ...agent,
  description: {
    "customer-support-v2": "Handles customer inquiries, billing questions, and support tickets using RAG and knowledge base search.",
    "lead-qualifier": "Qualifies inbound leads by analyzing company data, budget signals, and engagement patterns.",
    "invoice-processor": "Extracts data from invoices, validates against POs, and processes payments.",
    "data-analyst": "Generates reports, performs analysis, and creates visualizations from business data.",
    "onboarding-assistant": "Guides new users through setup, configuration, and initial training.",
  }[agent.id],
  tags: {
    "customer-support-v2": ["production", "high-priority", "rag"],
    "lead-qualifier": ["production", "sales", "ml"],
    "invoice-processor": ["production", "finance", "ocr"],
    "data-analyst": ["production", "analytics", "bi"],
    "onboarding-assistant": ["production", "hr", "onboarding"],
  }[agent.id],
  model: {
    "customer-support-v2": "gpt-4o",
    "lead-qualifier": "gpt-4o",
    "invoice-processor": "claude-3.5-sonnet",
    "data-analyst": "gpt-4o",
    "onboarding-assistant": "claude-3.5-sonnet",
  }[agent.id],
  createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
  lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
}));
// ============================================================================
// API-TYPED MOCK DATA (for hooks placeholderData)
// ============================================================================

import type {
  ExecutionStats,
  ExecutionSummary,
  Agent,
  CostSummary,
  Incident,
  IncidentStats,
  PaginatedResponse,
} from "./types";

export const mockExecutionStats: ExecutionStats = {
  total_executions: 1247,
  successful_executions: 1174,
  failed_executions: 73,
  running_executions: 2,
  success_rate: 94.3,
  total_cost_usd: 24.73,
  total_tokens: 847293,
  avg_duration_ms: 1847,
  avg_quality_score: 87.4,
  p95_latency_ms: 4230,
  executions_by_status: {
    pending: 0,
    running: 2,
    completed: 1174,
    failed: 73,
    cancelled: 0,
  },
  executions_by_environment: {
    development: 89,
    staging: 124,
    production: 1034,
  },
  hourly_executions: mockExecutionVolume.labels.map((hour, i) => ({
    hour,
    count: mockExecutionVolume.total[i],
    cost: Math.round(mockExecutionVolume.total[i] * 0.019 * 100) / 100,
  })),
};

export const mockExecutionsPaginated: PaginatedResponse<ExecutionSummary> = {
  data: mockExecutions.map(exec => ({
    execution_id: exec.id,
    agent_id: exec.agent_id,
    environment: "production" as const,
    status: exec.status as "completed" | "failed",
    quality_score: exec.quality_score,
    total_cost_usd: exec.total_cost_usd,
    total_tokens: exec.token_count,
    duration_ms: exec.duration_ms,
    started_at: exec.started_at,
    completed_at: exec.ended_at,
    llm_calls_count: Math.floor(Math.random() * 8) + 2,
    tool_calls_count: Math.floor(Math.random() * 6) + 1,
  })),
  has_more: true,
  next_cursor: "cursor_mock_123",
};

export const mockAgentsTyped: Agent[] = mockAgentHealth.map((agent, i) => ({
  id: `agent_${i + 1}`,
  org_id: "org_demo",
  agent_id: agent.id,
  name: agent.name,
  description: mockAgentsExtended[i]?.description || "",
  current_version: agent.version,
  environment: "production" as const,
  is_active: agent.status === "active",
  last_execution_at: new Date(Date.now() - (i + 1) * 5 * 60 * 1000).toISOString(),
  total_executions: agent.totalExecutions,
  success_rate: agent.successRate7d,
  avg_cost_per_execution: agent.costToday / Math.max(1, agent.totalExecutions),
  created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
}));

export const mockCostSummary = {
  total_cost: mockCosts.totalMonth,
  total_tokens: 847293,
  execution_count: 1247,
  cost_change_percent: 8.4,
  by_model: [
    { model_id: "gpt-4o", provider: "openai", cost: mockCosts.totalMonth * 0.38, input_tokens: 234847, output_tokens: 108000, call_count: 487 },
    { model_id: "claude-3.5-sonnet", provider: "anthropic", cost: mockCosts.totalMonth * 0.31, input_tokens: 187423, output_tokens: 100000, call_count: 412 },
    { model_id: "gpt-4o-mini", provider: "openai", cost: mockCosts.totalMonth * 0.19, input_tokens: 106234, output_tokens: 50000, call_count: 234 },
    { model_id: "claude-3-haiku", provider: "anthropic", cost: mockCosts.totalMonth * 0.12, input_tokens: 68432, output_tokens: 30000, call_count: 114 },
  ],
  by_agent: mockCostBreakdown.map(item => ({
    agent_id: item.name.toLowerCase().replace(/\s+/g, '-'),
    cost: (mockCosts.totalMonth * item.percentage) / 100,
    execution_count: Math.floor(Math.random() * 300) + 100,
  })),
  daily: mockCosts.dailyCosts.map(d => ({
    date: d.date,
    cost: d.cost,
    tokens: Math.floor(d.cost * 2800),
    executions: Math.floor(d.cost * 4.2),
  })),
} as CostSummary;

export const mockIncidentsTyped = mockIncidents.map((inc) => ({
  id: inc.id,
  org_id: "org_demo",
  incident_type: inc.type,
  severity: inc.severity,
  status: inc.status,
  title: inc.title,
  description: inc.description,
  agent_id: inc.agent_id,
  execution_ids: [],
  detected_at: inc.created_at,
  acknowledged_at: inc.status !== "open" ? new Date(Date.now() - 30 * 60 * 1000).toISOString() : undefined,
  resolved_at: inc.status === "resolved" ? new Date(Date.now() - 10 * 60 * 1000).toISOString() : undefined,
  created_at: inc.created_at,
  updated_at: inc.created_at,
})) as Incident[];

export const mockIncidentStatsTyped = {
  total: mockIncidentStats.total_count,
  open_count: mockIncidentStats.open_count,
  acknowledged_count: mockIncidentStats.acknowledged_count,
  resolved_count: mockIncidentStats.resolved_count,
  critical_count: mockIncidentStats.critical_count,
  high_count: mockIncidentStats.high_count,
  medium_count: mockIncidentStats.warning_count,
  low_count: mockIncidentStats.low_count,
  avg_acknowledge_seconds: mockIncidentStats.avg_acknowledge_seconds,
  avg_resolve_seconds: mockIncidentStats.avg_resolve_seconds,
} as IncidentStats;

// ============================================================================
// SETTINGS MOCK DATA
// ============================================================================

export const mockSettings = {
  organization: {
    name: "Acme Corp",
    slug: "acme-corp",
    plan: "Professional",
    timezone: "America/Sao_Paulo",
    monthlyBudget: 5000,
  },
  team: [
    { id: "1", name: "Rafael Zara", email: "rafael@acme.com", 
      role: "owner" as const, avatar: "RZ", lastActive: "Online now" },
    { id: "2", name: "Ana Silva", email: "ana@acme.com", 
      role: "admin" as const, avatar: "AS", lastActive: "2h ago" },
    { id: "3", name: "Carlos Mendes", email: "carlos@acme.com", 
      role: "developer" as const, avatar: "CM", lastActive: "Yesterday" },
  ],
  apiKeys: [
    { id: "key_1", name: "Production SDK", prefix: "agops_sk_prod_", 
      created: "Jan 15, 2026", lastUsed: "2 minutes ago", status: "active" as const },
    { id: "key_2", name: "Staging SDK", prefix: "agops_sk_stag_", 
      created: "Feb 3, 2026", lastUsed: "1 day ago", status: "active" as const },
  ],
  integrations: [
    { name: "Slack", icon: "slack", connected: true, 
      detail: "#ai-alerts channel", since: "Dec 2025" },
    { name: "PagerDuty", icon: "pagerduty", connected: false, detail: null },
    { name: "Jira", icon: "jira", connected: true, 
      detail: "AIOPS project", since: "Jan 2026" },
    { name: "GitHub Actions", icon: "github", connected: false, detail: null },
    { name: "Datadog", icon: "datadog", connected: false, detail: null },
    { name: "Linear", icon: "linear", connected: false, detail: null },
  ],
  billing: {
    plan: "Professional",
    price: 499,
    billingDate: "April 1, 2026",
    usagePercent: 74,
    eventsUsed: "14.8M",
    eventsLimit: "20M",
    cardLast4: "4242",
  },
};

// ============================================================================
// NOTIFICATIONS MOCK DATA
// ============================================================================

export const mockNotifications = [
  {
    id: "notif_1",
    type: "critical" as const,
    title: "Critical incident detected",
    message: "Infinite loop in invoice-processor — 8 executions affected",
    time: "2m ago",
    read: false,
    link: "/incidents/inc-001",
  },
  {
    id: "notif_2",
    type: "warning" as const,
    title: "Cost threshold exceeded",
    message: "data-analyst spent $2.48 in a single execution (5x avg)",
    time: "23m ago",
    read: false,
    link: "/executions/exec_cost_spike",
  },
  {
    id: "notif_3",
    type: "warning" as const,
    title: "Quality degradation warning",
    message: "lead-qualifier avg quality dropped to 71 (was 88)",
    time: "2h ago",
    read: false,
    link: "/agents/lead-qualifier",
  },
  {
    id: "notif_4",
    type: "success" as const,
    title: "Incident resolved",
    message: "Rate limit on OpenAI API — resolved automatically",
    time: "3h ago",
    read: true,
    link: "/incidents/inc-resolved",
  },
  {
    id: "notif_5",
    type: "info" as const,
    title: "Cost optimization available",
    message: "Switching 40% of tasks to Claude Haiku saves ~$127/mo",
    time: "1d ago",
    read: true,
    link: "/costs",
  },
];