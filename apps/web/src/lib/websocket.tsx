"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./hooks";
import type { WSMessage, WSExecutionEvent, WSIncidentEvent, ExecutionSummary, Incident } from "./types";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

interface UseWebSocketOptions {
  enabled?: boolean;
  onExecutionUpdate?: (event: WSExecutionEvent) => void;
  onIncidentCreated?: (event: WSIncidentEvent) => void;
}

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function useRealtimeUpdates(options: UseWebSocketOptions = {}) {
  const { enabled = true, onExecutionUpdate, onIncidentCreated } = options;
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const queryClient = useQueryClient();
  
  const connect = useCallback(() => {
    if (!enabled) return;
    
    const token = localStorage.getItem("access_token");
    if (!token) {
      setStatus("disconnected");
      return;
    }
    
    setStatus("connecting");
    
    try {
      const ws = new WebSocket(`${WS_BASE_URL}/api/v1/ws/ws?token=${token}`);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setStatus("connected");
        reconnectAttemptRef.current = 0;
        
        // Subscribe to channels
        ws.send(JSON.stringify({ type: "subscribe", channels: ["executions", "incidents", "costs"] }));
      };
      
      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case "execution_started":
            case "execution_completed":
            case "execution_failed": {
              const execEvent = message.data as WSExecutionEvent;
              
              // Update execution list cache
              queryClient.setQueryData<{ data: ExecutionSummary[] }>(
                queryKeys.executions(),
                (old) => {
                  if (!old) return old;
                  
                  // Find and update or prepend
                  const exists = old.data.some((e) => e.execution_id === execEvent.execution_id);
                  
                  if (exists) {
                    return {
                      ...old,
                      data: old.data.map((e) =>
                        e.execution_id === execEvent.execution_id
                          ? { ...e, status: execEvent.status, total_cost_usd: execEvent.cost_usd ?? e.total_cost_usd }
                          : e
                      ),
                    };
                  } else if (message.type === "execution_started") {
                    // Prepend new execution
                    const newExec: ExecutionSummary = {
                      execution_id: execEvent.execution_id,
                      agent_id: execEvent.agent_id,
                      status: execEvent.status,
                      environment: "production",
                      total_cost_usd: 0,
                      total_tokens: 0,
                      duration_ms: 0,
                      started_at: new Date().toISOString(),
                      llm_calls_count: 0,
                      tool_calls_count: 0,
                    };
                    return { ...old, data: [newExec, ...old.data.slice(0, 49)] };
                  }
                  
                  return old;
                }
              );
              
              // Invalidate stats
              queryClient.invalidateQueries({ queryKey: queryKeys.executionStats() });
              
              onExecutionUpdate?.(execEvent);
              break;
            }
            
            case "incident_created": {
              const incidentEvent = message.data as WSIncidentEvent;
              
              // Add to incidents list
              queryClient.setQueryData<Incident[]>(queryKeys.incidents(), (old) => {
                if (!old) return old;
                
                const newIncident: Incident = {
                  id: incidentEvent.incident_id,
                  org_id: "",
                  incident_type: "auto_detected",
                  severity: incidentEvent.severity,
                  status: "open",
                  title: incidentEvent.title,
                  agent_id: incidentEvent.agent_id,
                  detected_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                
                return [newIncident, ...old];
              });
              
              // Invalidate stats
              queryClient.invalidateQueries({ queryKey: queryKeys.incidentStats() });
              
              onIncidentCreated?.(incidentEvent);
              break;
            }
            
            case "cost_update": {
              // Invalidate cost queries
              queryClient.invalidateQueries({ queryKey: queryKeys.costsSummary() });
              queryClient.invalidateQueries({ queryKey: queryKeys.costsForecast() });
              break;
            }
            
            case "ping": {
              // Respond with pong
              ws.send(JSON.stringify({ type: "pong" }));
              break;
            }
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };
      
      ws.onclose = () => {
        setStatus("disconnected");
        wsRef.current = null;
        
        // Exponential backoff reconnect
        if (enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
          reconnectAttemptRef.current += 1;
          
          setStatus("reconnecting");
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };
      
      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      setStatus("disconnected");
    }
  }, [enabled, queryClient, onExecutionUpdate, onIncidentCreated]);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setStatus("disconnected");
  }, []);
  
  // Connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  // Reconnect on visibility change (tab becomes active)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && status === "disconnected" && enabled) {
        connect();
      }
    }
    
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [status, enabled, connect]);
  
  return {
    status,
    isConnected: status === "connected",
    isReconnecting: status === "reconnecting",
    reconnect: connect,
    disconnect,
  };
}

// Connection status indicator component
export function ConnectionStatus({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-500">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </div>
    );
  }
  
  if (status === "reconnecting") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-500">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        Reconnecting...
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-muted-foreground" />
      Offline
    </div>
  );
}
