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
  { bg: string; text: string; dot: string }
> = {
  // Success states
  success: {
    bg: "bg-[hsl(var(--success-subtle))]",
    text: "text-[hsl(var(--success))]",
    dot: "bg-[hsl(var(--success))]",
  },
  completed: {
    bg: "bg-[hsl(var(--success-subtle))]",
    text: "text-[hsl(var(--success))]",
    dot: "bg-[hsl(var(--success))]",
  },
  resolved: {
    bg: "bg-[hsl(var(--success-subtle))]",
    text: "text-[hsl(var(--success))]",
    dot: "bg-[hsl(var(--success))]",
  },

  // Warning states
  warning: {
    bg: "bg-[hsl(var(--warning-subtle))]",
    text: "text-[hsl(var(--warning))]",
    dot: "bg-[hsl(var(--warning))]",
  },
  pending: {
    bg: "bg-[hsl(var(--warning-subtle))]",
    text: "text-[hsl(var(--warning))]",
    dot: "bg-[hsl(var(--warning))]",
  },
  acknowledged: {
    bg: "bg-[hsl(var(--warning-subtle))]",
    text: "text-[hsl(var(--warning))]",
    dot: "bg-[hsl(var(--warning))]",
  },
  high: {
    bg: "bg-[hsl(var(--warning-subtle))]",
    text: "text-[hsl(var(--warning))]",
    dot: "bg-[hsl(var(--warning))]",
  },

  // Error/Critical states
  error: {
    bg: "bg-[hsl(var(--error-subtle))]",
    text: "text-[hsl(var(--error))]",
    dot: "bg-[hsl(var(--error))]",
  },
  failed: {
    bg: "bg-[hsl(var(--error-subtle))]",
    text: "text-[hsl(var(--error))]",
    dot: "bg-[hsl(var(--error))]",
  },
  open: {
    bg: "bg-[hsl(var(--error-subtle))]",
    text: "text-[hsl(var(--error))]",
    dot: "bg-[hsl(var(--error))]",
  },
  critical: {
    bg: "bg-[hsl(var(--error-subtle))]",
    text: "text-[hsl(var(--error))]",
    dot: "bg-[hsl(var(--error))]",
  },

  // Info/Running states
  info: {
    bg: "bg-[hsl(var(--info-subtle))]",
    text: "text-[hsl(var(--info))]",
    dot: "bg-[hsl(var(--info))]",
  },
  running: {
    bg: "bg-[hsl(var(--info-subtle))]",
    text: "text-[hsl(var(--info))]",
    dot: "bg-[hsl(var(--info))] animate-pulse",
  },

  // Neutral states
  neutral: {
    bg: "bg-[hsl(var(--bg-hover))]",
    text: "text-[hsl(var(--text-muted))]",
    dot: "bg-[hsl(var(--text-muted))]",
  },
  medium: {
    bg: "bg-[hsl(var(--bg-hover))]",
    text: "text-[hsl(var(--text-muted))]",
    dot: "bg-[hsl(var(--text-muted))]",
  },
  low: {
    bg: "bg-[hsl(var(--bg-hover))]",
    text: "text-[hsl(var(--text-disabled))]",
    dot: "bg-[hsl(var(--text-disabled))]",
  },
};

const sizeClasses = {
  sm: "text-[10px] px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
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
        "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide",
        config.bg,
        config.text,
        sizeClasses[size],
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
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
