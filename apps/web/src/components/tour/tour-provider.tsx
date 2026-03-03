"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { X, HelpCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface TourStep {
  target: string; // CSS selector
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface TourContextValue {
  isOpen: boolean;
  currentStep: number;
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

// ============================================================================
// TOUR STEPS
// ============================================================================

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='kpi-cards']",
    title: "Your Agent Fleet at a Glance",
    description: "These cards show real-time metrics for all your AI agents — total executions, success rates, costs, and active alerts.",
    position: "bottom",
  },
  {
    target: "[data-tour='live-feed']",
    title: "Every Execution in Real Time",
    description: "Watch your agents execute in real-time. Click any row to see the full trace with LLM calls, tool usage, and timing.",
    position: "right",
  },
  {
    target: "[data-tour='cost-card']",
    title: "Know Exactly What AI Costs You",
    description: "Track spend per agent, per model, and per execution. Set budgets and get alerts before costs spiral.",
    position: "left",
  },
  {
    target: "[data-tour='incidents']",
    title: "Get Alerted Before Users Notice",
    description: "Our system automatically detects loops, failures, and anomalies. Acknowledge and resolve incidents from one place.",
    position: "top",
  },
];

const STORAGE_KEY = "agentops_tour_completed";

// ============================================================================
// CONTEXT
// ============================================================================

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within TourProvider");
  }
  return context;
}

// ============================================================================
// SPOTLIGHT OVERLAY
// ============================================================================

function SpotlightOverlay({ 
  targetRect, 
  step, 
  onNext, 
  onPrev, 
  onClose,
  currentIndex,
  totalSteps,
}: { 
  targetRect: DOMRect | null;
  step: TourStep;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  currentIndex: number;
  totalSteps: number;
}) {
  const padding = 8;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!targetRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    
    const pos = step.position || "bottom";
    const tooltipWidth = 320;
    const tooltipHeight = 160;
    const offset = 16;

    switch (pos) {
      case "top":
        return {
          top: targetRect.top - tooltipHeight - offset,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case "bottom":
        return {
          top: targetRect.bottom + offset,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case "left":
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.left - tooltipWidth - offset,
        };
      case "right":
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.right + offset,
        };
      default:
        return { top: targetRect.bottom + offset, left: targetRect.left };
    }
  };

  const tooltipPos = getTooltipPosition();

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Highlight ring */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="absolute w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4"
        style={{
          top: typeof tooltipPos.top === "number" ? tooltipPos.top : undefined,
          left: typeof tooltipPos.left === "number" ? tooltipPos.left : undefined,
          ...(typeof tooltipPos.transform === "string" ? tooltipPos : {}),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-zinc-800 rounded transition-colors"
          aria-label="Close tour"
        >
          <X className="h-4 w-4 text-zinc-400" />
        </button>

        {/* Content */}
        <div className="pr-8">
          <h3 className="font-semibold text-lg">{step.title}</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800">
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} of {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={onPrev} className="h-8 gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={onNext} className="h-8 gap-1">
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TOUR BUTTON
// ============================================================================

export function TourButton() {
  const { startTour } = useTour();
  const [completed, setCompleted] = useState(true);

  useEffect(() => {
    setCompleted(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  return (
    <button
      onClick={startTour}
      className={cn(
        "fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg transition-all z-50",
        "bg-primary hover:bg-primary/90 text-primary-foreground",
        "flex items-center justify-center",
        !completed && "animate-bounce"
      )}
      aria-label="Start product tour"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}

// ============================================================================
// PROVIDER
// ============================================================================

export function TourProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const updateTargetRect = useCallback(() => {
    if (!isOpen) return;
    
    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    const element = document.querySelector(step.target);
    if (element) {
      setTargetRect(element.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStep]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect);
    return () => {
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect);
    };
  }, [updateTargetRect]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const endTour = useCallback(() => {
    setIsOpen(false);
    setCurrentStep(0);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep >= TOUR_STEPS.length - 1) {
      endTour();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, endTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        endTour();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, endTour]);

  return (
    <TourContext.Provider
      value={{
        isOpen,
        currentStep,
        startTour,
        endTour,
        nextStep,
        prevStep,
      }}
    >
      {children}
      {isOpen && TOUR_STEPS[currentStep] && (
        <SpotlightOverlay
          targetRect={targetRect}
          step={TOUR_STEPS[currentStep]}
          onNext={nextStep}
          onPrev={prevStep}
          onClose={endTour}
          currentIndex={currentStep}
          totalSteps={TOUR_STEPS.length}
        />
      )}
    </TourContext.Provider>
  );
}
