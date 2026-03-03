/**
 * TanStack Query hooks for all API endpoints
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { api, ApiError } from "./api-client";
import type {
  ExecutionSummary,
  ExecutionWithTrace,
  ExecutionStats,
  Agent,
  CostSummary,
  CostForecast,
  Incident,
  IncidentStats,
  IncidentTimeline,
  AlertRule,
  AlertRuleCreate,
  AuditLogResponse,
  User,
  ApiKey,
  ApiKeyCreateResponse,
  PaginatedResponse,
  IncidentSeverity,
  IncidentStatus,
} from "./types";

// ============================================================================
// Query Keys
// ============================================================================

export const queryKeys = {
  // Auth
  user: ["user"] as const,
  apiKeys: ["api-keys"] as const,
  
  // Executions
  executions: (filters?: Record<string, unknown>) => ["executions", filters] as const,
  execution: (id: string) => ["execution", id] as const,
  executionTrace: (id: string) => ["execution", id, "trace"] as const,
  executionStats: (period?: string) => ["execution-stats", period] as const,
  
  // Agents
  agents: (filters?: Record<string, unknown>) => ["agents", filters] as const,
  agent: (id: string) => ["agent", id] as const,
  
  // Costs
  costsSummary: (period?: string) => ["costs", "summary", period] as const,
  costsByAgent: (period?: string) => ["costs", "by-agent", period] as const,
  costsForecast: () => ["costs", "forecast"] as const,
  
  // Incidents
  incidents: (filters?: Record<string, unknown>) => ["incidents", filters] as const,
  incident: (id: string) => ["incident", id] as const,
  incidentTimeline: (id: string) => ["incident", id, "timeline"] as const,
  incidentStats: (period?: string) => ["incident-stats", period] as const,
  
  // Alerts
  alertRules: (filters?: Record<string, unknown>) => ["alert-rules", filters] as const,
  alertRule: (id: string) => ["alert-rule", id] as const,
  
  // Compliance
  auditLog: (filters?: Record<string, unknown>) => ["audit-log", filters] as const,
};

// ============================================================================
// Auth Hooks
// ============================================================================

export function useCurrentUser(options?: Partial<UseQueryOptions<User>>) {
  return useQuery<User>({
    queryKey: queryKeys.user,
    queryFn: () => api.get<User>("/api/v1/auth/me"),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    ...options,
  });
}

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: queryKeys.apiKeys,
    queryFn: () => api.get<ApiKey[]>("/api/v1/auth/api-keys"),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  
  return useMutation<ApiKeyCreateResponse, ApiError, { name: string; scopes: string[]; expires_in_days?: number }>({
    mutationFn: (data) => api.post<ApiKeyCreateResponse>("/api/v1/auth/api-keys", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  
  return useMutation<void, ApiError, string>({
    mutationFn: (keyId) => api.delete<void>(`/api/v1/auth/api-keys/${keyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

// ============================================================================
// Execution Hooks
// ============================================================================

interface ExecutionFilters {
  [key: string]: string | number | boolean | undefined;
  agent_id?: string;
  status?: string;
  environment?: string;
  cursor?: string;
  limit?: number;
}

export function useExecutions(filters?: ExecutionFilters) {
  return useQuery<PaginatedResponse<ExecutionSummary>>({
    queryKey: queryKeys.executions(filters),
    queryFn: () => api.get<PaginatedResponse<ExecutionSummary>>("/api/v1/executions", filters),
    staleTime: 10 * 1000, // 10 seconds
  });
}

export function useExecution(id: string) {
  return useQuery<ExecutionWithTrace>({
    queryKey: queryKeys.execution(id),
    queryFn: () => api.get<ExecutionWithTrace>(`/api/v1/executions/${id}`),
    enabled: !!id,
  });
}

export function useExecutionTrace(id: string) {
  return useQuery<ExecutionWithTrace>({
    queryKey: queryKeys.executionTrace(id),
    queryFn: () => api.get<ExecutionWithTrace>(`/api/v1/executions/${id}/trace`),
    enabled: !!id,
  });
}

export function useExecutionStats(period: string = "24h") {
  return useQuery<ExecutionStats>({
    queryKey: queryKeys.executionStats(period),
    queryFn: () => api.get<ExecutionStats>("/api/v1/executions/stats/summary", { period }),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============================================================================
// Agent Hooks
// ============================================================================

interface AgentFilters {
  [key: string]: string | boolean | undefined;
  is_active?: boolean;
  environment?: string;
}

export function useAgents(filters?: AgentFilters) {
  return useQuery<Agent[]>({
    queryKey: queryKeys.agents(filters),
    queryFn: () => api.get<Agent[]>("/api/v1/agents", filters),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useAgent(id: string) {
  return useQuery<Agent>({
    queryKey: queryKeys.agent(id),
    queryFn: () => api.get<Agent>(`/api/v1/agents/${id}`),
    enabled: !!id,
  });
}

// ============================================================================
// Cost Hooks
// ============================================================================

export function useCostsSummary(period: string = "30d") {
  return useQuery<CostSummary>({
    queryKey: queryKeys.costsSummary(period),
    queryFn: () => api.get<CostSummary>("/api/v1/costs/summary", { period }),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCostsForecast() {
  return useQuery<CostForecast>({
    queryKey: queryKeys.costsForecast(),
    queryFn: () => api.get<CostForecast>("/api/v1/costs/forecast"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useExportCosts() {
  return useMutation<Blob, ApiError, { period: string; format?: string }>({
    mutationFn: async ({ period, format = "csv" }) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/costs/export?period=${period}&format=${format}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      if (!response.ok) throw new ApiError(response.status, "export_error", "Failed to export");
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `costs-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

// ============================================================================
// Incident Hooks
// ============================================================================

interface IncidentFilters {
  [key: string]: IncidentStatus | IncidentSeverity | IncidentStatus[] | IncidentSeverity[] | string | number | undefined;
  status?: IncidentStatus | IncidentStatus[];
  severity?: IncidentSeverity | IncidentSeverity[];
  agent_id?: string;
  limit?: number;
  offset?: number;
}

// Convert array filters to comma-separated strings for API
function normalizeFilters(filters?: IncidentFilters): Record<string, string | number | boolean | undefined | null> | undefined {
  if (!filters) return undefined;
  const normalized: Record<string, string | number | boolean | undefined | null> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      normalized[key] = value.join(",");
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

export function useIncidents(filters?: IncidentFilters) {
  return useQuery<Incident[]>({
    queryKey: queryKeys.incidents(filters),
    queryFn: () => api.get<Incident[]>("/api/v1/incidents", normalizeFilters(filters)),
    staleTime: 10 * 1000, // 10 seconds
  });
}

export function useIncident(id: string) {
  return useQuery<Incident>({
    queryKey: queryKeys.incident(id),
    queryFn: () => api.get<Incident>(`/api/v1/incidents/${id}`),
    enabled: !!id,
  });
}

export function useIncidentTimeline(id: string) {
  return useQuery<IncidentTimeline>({
    queryKey: queryKeys.incidentTimeline(id),
    queryFn: () => api.get<IncidentTimeline>(`/api/v1/incidents/${id}/timeline`),
    enabled: !!id,
  });
}

export function useIncidentStats(period: string = "30d") {
  return useQuery<IncidentStats>({
    queryKey: queryKeys.incidentStats(period),
    queryFn: () => api.get<IncidentStats>("/api/v1/incidents/stats/summary", { period }),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useAcknowledgeIncident() {
  const queryClient = useQueryClient();
  
  return useMutation<Incident, ApiError, string, { previousIncidents?: Incident[] }>({
    mutationFn: (id) => api.patch<Incident>(`/api/v1/incidents/${id}`, { status: "acknowledged" }),
    
    // Optimistic update
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.incidents() });
      const previousIncidents = queryClient.getQueryData<Incident[]>(queryKeys.incidents());
      
      queryClient.setQueryData<Incident[]>(queryKeys.incidents(), (old) =>
        old?.map((incident) =>
          incident.id === id
            ? { ...incident, status: "acknowledged" as IncidentStatus, acknowledged_at: new Date().toISOString() }
            : incident
        )
      );
      
      return { previousIncidents };
    },
    
    onError: (err, id, context) => {
      if (context?.previousIncidents) {
        queryClient.setQueryData(queryKeys.incidents(), context.previousIncidents);
      }
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incidents() });
      queryClient.invalidateQueries({ queryKey: queryKeys.incidentStats() });
    },
  });
}

export function useResolveIncident() {
  const queryClient = useQueryClient();
  
  return useMutation<Incident, ApiError, { id: string; resolution_notes?: string }, { previousIncidents?: Incident[] }>({
    mutationFn: ({ id, resolution_notes }) =>
      api.patch<Incident>(`/api/v1/incidents/${id}`, { status: "resolved", resolution_notes }),
    
    // Optimistic update
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.incidents() });
      const previousIncidents = queryClient.getQueryData<Incident[]>(queryKeys.incidents());
      
      queryClient.setQueryData<Incident[]>(queryKeys.incidents(), (old) =>
        old?.map((incident) =>
          incident.id === id
            ? { ...incident, status: "resolved" as IncidentStatus, resolved_at: new Date().toISOString() }
            : incident
        )
      );
      
      return { previousIncidents };
    },
    
    onError: (err, vars, context) => {
      if (context?.previousIncidents) {
        queryClient.setQueryData(queryKeys.incidents(), context.previousIncidents);
      }
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incidents() });
      queryClient.invalidateQueries({ queryKey: queryKeys.incidentStats() });
    },
  });
}

// ============================================================================
// Alert Hooks
// ============================================================================

interface AlertFilters {
  [key: string]: boolean | undefined;
  enabled?: boolean;
}

export function useAlertRules(filters?: AlertFilters) {
  return useQuery<AlertRule[]>({
    queryKey: queryKeys.alertRules(filters),
    queryFn: () => api.get<AlertRule[]>("/api/v1/alerts/rules", filters),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useAlertRule(id: string) {
  return useQuery<AlertRule>({
    queryKey: queryKeys.alertRule(id),
    queryFn: () => api.get<AlertRule>(`/api/v1/alerts/rules/${id}`),
    enabled: !!id,
  });
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  
  return useMutation<AlertRule, ApiError, AlertRuleCreate>({
    mutationFn: (data) => api.post<AlertRule>("/api/v1/alerts/rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alertRules() });
    },
  });
}

export function useUpdateAlertRule() {
  const queryClient = useQueryClient();
  
  return useMutation<AlertRule, ApiError, { id: string; data: Partial<AlertRule> }, { previousRules?: AlertRule[] }>({
    mutationFn: ({ id, data }) => api.put<AlertRule>(`/api/v1/alerts/rules/${id}`, data),
    
    // Optimistic update for toggle
    onMutate: async ({ id, data }) => {
      if (data.enabled === undefined) return {};
      
      await queryClient.cancelQueries({ queryKey: queryKeys.alertRules() });
      const previousRules = queryClient.getQueryData<AlertRule[]>(queryKeys.alertRules());
      
      queryClient.setQueryData<AlertRule[]>(queryKeys.alertRules(), (old) =>
        old?.map((rule) => (rule.id === id ? { ...rule, ...data } : rule))
      );
      
      return { previousRules };
    },
    
    onError: (err, vars, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(queryKeys.alertRules(), context.previousRules);
      }
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alertRules() });
    },
  });
}

export function useDeleteAlertRule() {
  const queryClient = useQueryClient();
  
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/api/v1/alerts/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alertRules() });
    },
  });
}

export function useTestAlertRule() {
  return useMutation<{ success: boolean; message: string }, ApiError, string>({
    mutationFn: (id) => api.post<{ success: boolean; message: string }>(`/api/v1/alerts/rules/${id}/test`),
  });
}

// ============================================================================
// Compliance Hooks
// ============================================================================

interface AuditLogFilters {
  [key: string]: string | number | undefined;
  action?: string;
  resource_type?: string;
  actor_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export function useAuditLog(filters?: AuditLogFilters) {
  return useQuery<AuditLogResponse>({
    queryKey: queryKeys.auditLog(filters),
    queryFn: () => api.get<AuditLogResponse>("/api/v1/compliance/audit", filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useExportCompliance() {
  return useMutation<Blob, ApiError, { export_type: string; format: string; from_date: string; to_date: string }>({
    mutationFn: async (data) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/compliance/export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new ApiError(response.status, "export_error", "Failed to export");
      return response.blob();
    },
    onSuccess: (blob, variables) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-${variables.export_type}-${new Date().toISOString().split("T")[0]}.${variables.format}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
