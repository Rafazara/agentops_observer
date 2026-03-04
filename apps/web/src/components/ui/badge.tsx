import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-semibold transition-colors",
        // Size variants
        size === "sm" && "px-1.5 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-0.5 text-xs",
        // Color variants - Mixpanel style subtle backgrounds
        {
          "bg-[hsl(var(--primary))] text-white": variant === "default",
          "bg-[hsl(var(--bg-hover))] text-[hsl(var(--text-secondary))] border border-[hsl(var(--border-default))]": variant === "secondary",
          "bg-[hsl(var(--error-subtle))] text-[hsl(var(--error))]": variant === "destructive",
          "bg-transparent border border-[hsl(var(--border-default))] text-[hsl(var(--text-secondary))]": variant === "outline",
          "bg-[hsl(var(--success-subtle))] text-[hsl(var(--success))]": variant === "success",
          "bg-[hsl(var(--warning-subtle))] text-[hsl(var(--warning))]": variant === "warning",
          "bg-[hsl(var(--info-subtle))] text-[hsl(var(--info))]": variant === "info",
        },
        className
      )}
      {...props}
    />
  );
}
