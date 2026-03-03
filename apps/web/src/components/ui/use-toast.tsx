"use client";

import * as React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

type ToastType = "success" | "error" | "warning" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

// ============================================================================
// TOAST COMPONENT
// ============================================================================

const toastConfig = {
  success: {
    icon: CheckCircle2,
    borderColor: "border-l-emerald-500",
    iconColor: "text-emerald-500",
    bg: "bg-zinc-900",
  },
  error: {
    icon: XCircle,
    borderColor: "border-l-red-500",
    iconColor: "text-red-500",
    bg: "bg-zinc-900",
  },
  warning: {
    icon: AlertTriangle,
    borderColor: "border-l-amber-500",
    iconColor: "text-amber-500",
    bg: "bg-zinc-900",
  },
  info: {
    icon: Info,
    borderColor: "border-l-indigo-500",
    iconColor: "text-indigo-500",
    bg: "bg-zinc-900",
  },
};

function ToastItem({ 
  toast, 
  onDismiss 
}: { 
  toast: Toast; 
  onDismiss: () => void;
}) {
  const config = toastConfig[toast.type];
  const Icon = config.icon;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  return (
    <div
      className={cn(
        "relative flex gap-3 p-4 rounded-lg border border-zinc-800",
        "shadow-lg shadow-black/20",
        "border-l-4",
        config.borderColor,
        config.bg,
        "animate-in slide-in-from-right-full fade-in duration-300"
      )}
      role="alert"
    >
      <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{toast.description}</p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="inline-flex items-center gap-1 text-sm text-primary font-medium mt-2 hover:underline"
          >
            {toast.action.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="p-1 hover:bg-zinc-800 rounded transition-colors flex-shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4 text-zinc-400" />
      </button>
    </div>
  );
}

// ============================================================================
// PROVIDER & CONTAINER
// ============================================================================

export function RichToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((options: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...options, id };
    
    setToasts((prev) => {
      // Keep only last 3 toasts
      const updated = [...prev, newToast];
      if (updated.length > 3) {
        return updated.slice(-3);
      }
      return updated;
    });
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismissToast }}>
      {children}
      
      {/* Toast Container - bottom right */}
      <div 
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-96"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem 
            key={t.id} 
            toast={t} 
            onDismiss={() => dismissToast(t.id)} 
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createExecutionToast(
  agentName: string,
  quality: number,
  cost: number
): Omit<Toast, "id"> {
  return {
    type: "success",
    title: `✅ ${agentName} completed`,
    description: `Quality ${quality}/100 · $${cost.toFixed(4)}`,
  };
}

export function createIncidentToast(
  severity: "critical" | "warning",
  message: string,
  incidentId: string
): Omit<Toast, "id"> {
  return {
    type: severity === "critical" ? "error" : "warning",
    title: severity === "critical" ? `🔴 Critical: ${message}` : `⚠️ Warning: ${message}`,
    action: {
      label: "View",
      onClick: () => window.location.href = `/incidents/${incidentId}`,
    },
  };
}
