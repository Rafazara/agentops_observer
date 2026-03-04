"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { checkApiHealth, type ApiStatus } from "@/lib/data-layer";
import { Loader2 } from "lucide-react";

interface ApiStatusIndicatorProps {
  className?: string;
}

export function ApiStatusIndicator({ className }: ApiStatusIndicatorProps) {
  const [status, setStatus] = useState<ApiStatus>("demo");
  const [isChecking, setIsChecking] = useState(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const check = async () => {
      setIsChecking(true);
      setStatus("connecting");
      
      // Set a 5-second max for "connecting" state - if API doesn't respond, show "Demo"
      checkTimeoutRef.current = setTimeout(() => {
        setStatus("demo");
        setIsChecking(false);
      }, 5000);
      
      const isLive = await checkApiHealth(5000);
      
      // Clear the fallback timeout since we got a response
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
      
      setStatus(isLive ? "live" : "demo");
      setIsChecking(false);
    };

    // Initial check
    check();

    // Re-check every 60 seconds
    intervalId = setInterval(check, 60000);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, []);

  const statusConfig = {
    live: {
      label: "Live",
      dot: "bg-[hsl(var(--success))]",
      text: "text-[hsl(var(--success))]",
      animate: false,
      tooltip: "Connected to live API",
    },
    connecting: {
      label: "Connecting...",
      dot: "bg-[hsl(var(--warning))]",
      text: "text-[hsl(var(--warning))]",
      animate: true,
      tooltip: "Checking API connection...",
    },
    demo: {
      label: "Demo",
      dot: "bg-[hsl(var(--text-muted))]",
      text: "text-[hsl(var(--text-muted))]",
      animate: false,
      tooltip: "Using demo data · API offline",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-help",
        "bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]",
        className
      )}
      title={config.tooltip}
    >
      {isChecking ? (
        <Loader2 className="w-3 h-3 animate-spin text-[hsl(var(--warning))]" />
      ) : (
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            config.dot,
            config.animate && "animate-pulse"
          )}
        />
      )}
      <span className={config.text}>{config.label}</span>
    </div>
  );
}
