import { cn } from "@/lib/utils";

type StatusType =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "running"
  | "pending"
  | "completed"
  | "failed"
  | "open"
  | "acknowledged"
  | "resolved"
  | "critical"
  | "high"
  | "medium"
  | "low";

interface StatusBadgeProps {
  status: StatusType | string;
  children?: React.ReactNode;
  className?: string;
  showDot?: boolean;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  // Semantic statuses
  success: {
    bg: "bg-emerald-500/10",
    border: "border-l-emerald-500",
    text: "text-emerald-500",
    dot: "bg-emerald-500",
  },
  completed: {
    bg: "bg-emerald-500/10",
    border: "border-l-emerald-500",
    text: "text-emerald-500",
    dot: "bg-emerald-500",
  },
  resolved: {
    bg: "bg-emerald-500/10",
    border: "border-l-emerald-500",
    text: "text-emerald-500",
    dot: "bg-emerald-500",
  },

  warning: {
    bg: "bg-amber-500/10",
    border: "border-l-amber-500",
    text: "text-amber-500",
    dot: "bg-amber-500",
  },
  pending: {
    bg: "bg-amber-500/10",
    border: "border-l-amber-500",
    text: "text-amber-500",
    dot: "bg-amber-500",
  },
  acknowledged: {
    bg: "bg-amber-500/10",
    border: "border-l-amber-500",
    text: "text-amber-500",
    dot: "bg-amber-500",
  },
  high: {
    bg: "bg-amber-500/10",
    border: "border-l-amber-500",
    text: "text-amber-500",
    dot: "bg-amber-500",
  },

  error: {
    bg: "bg-red-500/10",
    border: "border-l-red-500",
    text: "text-red-500",
    dot: "bg-red-500",
  },
  failed: {
    bg: "bg-red-500/10",
    border: "border-l-red-500",
    text: "text-red-500",
    dot: "bg-red-500",
  },
  open: {
    bg: "bg-red-500/10",
    border: "border-l-red-500",
    text: "text-red-500",
    dot: "bg-red-500",
  },
  critical: {
    bg: "bg-red-500/10",
    border: "border-l-red-500",
    text: "text-red-500",
    dot: "bg-red-500",
  },

  info: {
    bg: "bg-blue-500/10",
    border: "border-l-blue-500",
    text: "text-blue-500",
    dot: "bg-blue-500",
  },
  running: {
    bg: "bg-blue-500/10",
    border: "border-l-blue-500",
    text: "text-blue-500",
    dot: "bg-blue-500 animate-pulse",
  },

  neutral: {
    bg: "bg-zinc-500/10",
    border: "border-l-zinc-500",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
  medium: {
    bg: "bg-zinc-500/10",
    border: "border-l-zinc-500",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
  low: {
    bg: "bg-zinc-500/10",
    border: "border-l-zinc-500",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-sm px-3 py-1.5",
};

export function StatusBadge({
  status,
  children,
  className,
  showDot = false,
  size = "sm",
}: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || statusConfig.neutral;
  const label = children || status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border-l-2 font-medium capitalize",
        config.bg,
        config.border,
        config.text,
        sizeClasses[size],
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      )}
      {label}
    </span>
  );
}

// Severity badge variant
export function SeverityBadge({
  severity,
  className,
}: {
  severity: "critical" | "high" | "medium" | "low" | string;
  className?: string;
}) {
  return (
    <StatusBadge status={severity} className={className} showDot>
      {severity}
    </StatusBadge>
  );
}

// Execution status badge
export function ExecutionStatusBadge({
  status,
  className,
}: {
  status: "running" | "completed" | "failed" | "pending" | string;
  className?: string;
}) {
  return (
    <StatusBadge status={status} className={className} showDot>
      {status}
    </StatusBadge>
  );
}

// Incident status badge
export function IncidentStatusBadge({
  status,
  className,
}: {
  status: "open" | "acknowledged" | "resolved" | string;
  className?: string;
}) {
  return (
    <StatusBadge status={status} className={className}>
      {status}
    </StatusBadge>
  );
}
