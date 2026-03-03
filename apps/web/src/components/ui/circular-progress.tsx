"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  className?: string;
  animated?: boolean;
}

function getColorByValue(value: number): string {
  if (value >= 80) return "stroke-emerald-500";
  if (value >= 60) return "stroke-amber-500";
  return "stroke-red-500";
}

function getTextColorByValue(value: number): string {
  if (value >= 80) return "text-emerald-500";
  if (value >= 60) return "text-amber-500";
  return "text-red-500";
}

export function CircularProgress({
  value,
  size = 48,
  strokeWidth = 4,
  showValue = true,
  className,
  animated = true,
}: CircularProgressProps) {
  const [animatedValue, setAnimatedValue] = useState(animated ? 0 : value);

  useEffect(() => {
    if (!animated) {
      setAnimatedValue(value);
      return;
    }

    const startTime = Date.now();
    const duration = 1000;
    const startValue = animatedValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * eased;

      setAnimatedValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, animated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedValue / 100) * circumference;

  const colorClass = getColorByValue(value);
  const textColorClass = getTextColorByValue(value);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-300", colorClass)}
        />
      </svg>
      {showValue && (
        <span
          className={cn(
            "absolute text-xs font-bold tabular-nums",
            textColorClass
          )}
        >
          {Math.round(animatedValue)}
        </span>
      )}
    </div>
  );
}

// Quality score variant
export function QualityScore({
  score,
  size = 56,
  className,
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <CircularProgress value={score} size={size} strokeWidth={5} />
    </div>
  );
}

// Larger quality score with label
export function QualityScoreCard({
  score,
  label,
  className,
}: {
  score: number;
  label?: string;
  className?: string;
}) {
  const getLabel = () => {
    if (label) return label;
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Good";
    if (score >= 60) return "Fair";
    return "Needs Attention";
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CircularProgress value={score} size={64} strokeWidth={6} />
      <div>
        <div className="text-sm font-medium">{getLabel()}</div>
        <div className="text-xs text-muted-foreground">Quality Score</div>
      </div>
    </div>
  );
}
