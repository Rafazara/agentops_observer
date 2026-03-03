import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  FileSearch,
  Inbox,
  Play,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: {
    container: "py-8",
    icon: "h-8 w-8",
    title: "text-lg",
    description: "text-sm",
  },
  md: {
    container: "py-12",
    icon: "h-12 w-12",
    title: "text-xl",
    description: "text-sm",
  },
  lg: {
    container: "py-16",
    icon: "h-16 w-16",
    title: "text-2xl",
    description: "text-base",
  },
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizes.container,
        className
      )}
    >
      <div className="relative mb-4">
        {/* Decorative background circles */}
        <div className="absolute inset-0 -m-4 rounded-full bg-gradient-to-br from-primary/5 to-transparent" />
        <div className="absolute inset-0 -m-2 rounded-full bg-gradient-to-br from-muted/30 to-transparent" />
        
        <div className="relative rounded-full bg-muted/50 p-4">
          <Icon className={cn(sizes.icon, "text-muted-foreground")} />
        </div>
      </div>
      
      <h3 className={cn("font-semibold mb-2", sizes.title)}>{title}</h3>
      <p className={cn("text-muted-foreground max-w-sm mb-4", sizes.description)}>
        {description}
      </p>
      
      {action && (
        <Button onClick={action.onClick} size={size === "sm" ? "sm" : "default"}>
          <Plus className="h-4 w-4 mr-2" />
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Preset empty states for common scenarios
export function NoExecutions({
  onAction,
  className,
}: {
  onAction?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Play}
      title="No executions yet"
      description="Your agent executions will appear here once they start running. Start your first execution to see metrics and traces."
      action={onAction ? { label: "Start Execution", onClick: onAction } : undefined}
      className={className}
    />
  );
}

export function NoAgents({
  onAction,
  className,
}: {
  onAction?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Bot}
      title="No agents configured"
      description="Register your first AI agent to start monitoring performance, costs, and quality metrics."
      action={onAction ? { label: "Add Agent", onClick: onAction } : undefined}
      className={className}
    />
  );
}

export function NoIncidents({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="No incidents"
      description="All systems are running smoothly. Incidents will appear here when issues are detected."
      className={className}
    />
  );
}

export function NoAlerts({
  onAction,
  className,
}: {
  onAction?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Bell}
      title="No alert rules configured"
      description="Set up alert rules to be notified when your agents encounter issues or exceed thresholds."
      action={onAction ? { label: "Create Alert Rule", onClick: onAction } : undefined}
      className={className}
    />
  );
}

export function NoSearchResults({
  query,
  className,
}: {
  query?: string;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={
        query
          ? `No results match "${query}". Try adjusting your search or filters.`
          : "No results match your current filters. Try adjusting your search criteria."
      }
      size="sm"
      className={className}
    />
  );
}

export function NoData({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={BarChart3}
      title="No data available"
      description="There's no data to display for the selected time range. Try selecting a different period."
      size="sm"
      className={className}
    />
  );
}

export function NoLogs({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={FileSearch}
      title="No logs found"
      description="No logs match your current filters. Logs appear here as your agents generate events."
      size="sm"
      className={className}
    />
  );
}
