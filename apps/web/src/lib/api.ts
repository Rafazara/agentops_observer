const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE_URL}${endpoint}`;

  // Add query parameters
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Get auth token from localStorage
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP error ${response.status}`);
  }

  return response.json();
}

// Executions API
export interface Execution {
  id: string;
  agent_id: string;
  organization_id: string;
  status: "pending" | "running" | "completed" | "failed";
  trigger: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  started_at: string;
  ended_at?: string;
  llm_calls?: number;
  tool_calls?: number;
  total_tokens?: number;
  total_cost_usd?: number;
}

export interface ExecutionsResponse {
  executions: Execution[];
  total: number;
  page: number;
  page_size: number;
}

export const executionsApi = {
  list: (params?: {
    agent_id?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) =>
    fetchApi<ExecutionsResponse>("/api/executions", {
      params,
    }),

  get: (id: string) => fetchApi<Execution>(`/api/executions/${id}`),

  getEvents: (id: string) =>
    fetchApi<{ events: Event[] }>(`/api/executions/${id}/events`),

  getAnalysis: (id: string) =>
    fetchApi<ExecutionAnalysis>(`/api/executions/${id}/analysis`),
};

export interface Event {
  id: string;
  execution_id: string;
  event_type: string;
  timestamp: string;
  data?: Record<string, unknown>;
  model?: string;
  provider?: string;
  input_tokens?: number;
  output_tokens?: number;
  duration_ms?: number;
  cost_usd?: number;
}

export interface ExecutionAnalysis {
  execution_id: string;
  summary?: string;
  detected_patterns?: string[];
  anomalies?: Array<{ type: string; description: string }>;
  recommendations?: string[];
  analyzed_at?: string;
}

// Agents API
export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  version?: string;
  config?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentMetrics {
  agent_id: string;
  period: string;
  execution_count: number;
  success_rate: number;
  avg_duration_ms: number;
  total_tokens: number;
  total_cost_usd: number;
}

export const agentsApi = {
  list: (params?: { is_active?: boolean }) =>
    fetchApi<{ agents: Agent[] }>("/api/agents", { params }),

  get: (id: string) => fetchApi<Agent>(`/api/agents/${id}`),

  getMetrics: (id: string, period?: string) =>
    fetchApi<AgentMetrics>(`/api/agents/${id}/metrics`, {
      params: { period },
    }),

  update: (id: string, data: Partial<Agent>) =>
    fetchApi<Agent>(`/api/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// Costs API
export interface CostSummary {
  period: string;
  total_cost_usd: number;
  total_executions: number;
  total_tokens: number;
  cost_per_execution: number;
  cost_by_model: Array<{ model: string; cost: number; tokens: number }>;
  cost_by_agent: Array<{ agent_id: string; agent_name: string; cost: number }>;
}

export interface CostForecast {
  current_daily_cost: number;
  projected_monthly_cost: number;
  trend_percentage: number;
  daily_forecast: Array<{ date: string; cost: number }>;
}

export const costsApi = {
  getSummary: (period?: string) =>
    fetchApi<CostSummary>("/api/costs/summary", { params: { period } }),

  getForecast: () => fetchApi<CostForecast>("/api/costs/forecast"),

  getModelComparison: () =>
    fetchApi<{ comparisons: ModelComparison[] }>("/api/costs/models/compare"),
};

export interface ModelComparison {
  model: string;
  provider: string;
  total_calls: number;
  total_cost: number;
  avg_cost_per_call: number;
  avg_latency_ms: number;
}

// Incidents API
export interface Incident {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "acknowledged" | "resolved";
  affected_agents: string[];
  root_cause?: string;
  resolution?: string;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface IncidentStats {
  total_incidents: number;
  open_incidents: number;
  mtta_minutes?: number;
  mttr_minutes?: number;
  by_severity: Record<string, number>;
}

export const incidentsApi = {
  list: (params?: { status?: string; severity?: string }) =>
    fetchApi<{ incidents: Incident[] }>("/api/incidents", { params }),

  get: (id: string) => fetchApi<Incident>(`/api/incidents/${id}`),

  create: (data: Omit<Incident, "id" | "created_at" | "organization_id">) =>
    fetchApi<Incident>("/api/incidents", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Incident>) =>
    fetchApi<Incident>(`/api/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getStats: () => fetchApi<IncidentStats>("/api/incidents/stats/summary"),

  getTimeline: (id: string) =>
    fetchApi<{ timeline: TimelineEntry[] }>(`/api/incidents/${id}/timeline`),
};

export interface TimelineEntry {
  timestamp: string;
  event_type: string;
  description: string;
  execution_id?: string;
}

// Dashboard API
export interface DashboardMetrics {
  active_agents: number;
  running_executions: number;
  success_rate_24h: number;
  total_cost_24h: number;
  open_incidents: number;
  p99_latency_ms: number;
}

export const dashboardApi = {
  getMetrics: () => fetchApi<DashboardMetrics>("/api/dashboard/metrics"),

  getRecentExecutions: (limit?: number) =>
    fetchApi<{ executions: Execution[] }>("/api/executions", {
      params: { page_size: limit || 10 },
    }),
};

// Auth API
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  role: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    fetchApi<void>("/api/auth/logout", {
      method: "POST",
    }),

  me: () => fetchApi<User>("/api/auth/me"),

  refresh: (refreshToken: string) =>
    fetchApi<LoginResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
};
