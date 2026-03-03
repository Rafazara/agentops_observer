"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RelativeTimeProps {
  date: Date | string;
  className?: string;
  updateInterval?: number;
}

function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months}mo ago`;
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 10) return `${seconds}s ago`;
  return "just now";
}

function formatAbsolute(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export function RelativeTime({
  date,
  className,
  updateInterval = 30000,
}: RelativeTimeProps) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const [relative, setRelative] = useState(formatRelative(dateObj));
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRelative(formatRelative(dateObj));
    }, updateInterval);

    return () => clearInterval(interval);
  }, [dateObj, updateInterval]);

  const absolute = formatAbsolute(dateObj);

  return (
    <span
      className={cn(
        "relative cursor-default",
        className
      )}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-muted-foreground hover:text-foreground transition-colors">
        {relative}
      </span>
      
      {showTooltip && (
        <span
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
            "px-2 py-1 rounded-md text-xs whitespace-nowrap",
            "bg-popover text-popover-foreground border border-border shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-100",
            "z-50"
          )}
        >
          {absolute}
          {/* Arrow */}
          <span
            className={cn(
              "absolute top-full left-1/2 -translate-x-1/2",
              "border-4 border-transparent border-t-border"
            )}
          />
          <span
            className={cn(
              "absolute top-full left-1/2 -translate-x-1/2 -mt-px",
              "border-4 border-transparent border-t-popover"
            )}
          />
        </span>
      )}
    </span>
  );
}

// Timestamp with icon variant
export function Timestamp({
  date,
  className,
  icon,
}: {
  date: Date | string;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      {icon}
      <RelativeTime date={date} />
    </span>
  );
}
