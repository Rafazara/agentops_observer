"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { checkApiHealth, type ApiStatus } from "@/lib/data-layer";
import { Loader2 } from "lucide-react";

interface ApiStatusIndicatorProps {
  className?: string;
}

export function ApiStatusIndicator({ className }: ApiStatusIndicatorProps) {
  const [status, setStatus] = useState<ApiStatus>("demo");
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const check = async () => {
      setIsChecking(true);
      setStatus("connecting");
      
      const isLive = await checkApiHealth(3000);
      setStatus(isLive ? "live" : "demo");
      setIsChecking(false);
    };

    // Initial check
    check();

    // Re-check every 60 seconds
    intervalId = setInterval(check, 60000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const statusConfig = {
    live: {
      label: "Live",
      dot: "bg-[hsl(var(--success))]",
      text: "text-[hsl(var(--success))]",
      animate: false,
    },
    connecting: {
      label: "Connecting...",
      dot: "bg-[hsl(var(--warning))]",
      text: "text-[hsl(var(--warning))]",
      animate: true,
    },
    demo: {
      label: "Demo",
      dot: "bg-[hsl(var(--text-muted))]",
      text: "text-[hsl(var(--text-muted))]",
      animate: false,
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all",
        "bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]",
        className
      )}
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
