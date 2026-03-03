"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatter?: (value: number) => string;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function CountUp({
  value,
  duration = 1500,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  formatter,
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const progress = Math.min(
        (timestamp - startTimeRef.current) / duration,
        1
      );
      const easedProgress = easeOutExpo(progress);
      const currentValue =
        startValueRef.current +
        (value - startValueRef.current) * easedProgress;

      setDisplayValue(currentValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration]);

  const formattedValue = formatter
    ? formatter(displayValue)
    : displayValue.toFixed(decimals);

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}

// Pre-styled variants for common use cases
export function CountUpNumber({
  value,
  className,
  ...props
}: Omit<CountUpProps, "formatter">) {
  const formatter = (val: number) => {
    if (val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(1)}M`;
    }
    if (val >= 1_000) {
      return `${(val / 1_000).toFixed(1)}K`;
    }
    return val.toFixed(0);
  };

  return (
    <CountUp
      value={value}
      formatter={formatter}
      className={cn("font-bold", className)}
      {...props}
    />
  );
}

export function CountUpCurrency({
  value,
  className,
  microCost = false,
  ...props
}: Omit<CountUpProps, "formatter" | "decimals" | "prefix"> & {
  microCost?: boolean;
}) {
  return (
    <CountUp
      value={value}
      prefix="$"
      decimals={microCost ? 4 : 2}
      className={cn("font-mono", className)}
      {...props}
    />
  );
}

export function CountUpPercent({
  value,
  className,
  ...props
}: Omit<CountUpProps, "suffix" | "decimals">) {
  return (
    <CountUp
      value={value}
      suffix="%"
      decimals={1}
      className={cn("font-bold", className)}
      {...props}
    />
  );
}
