"use client";

import { useState, useEffect } from "react";
import { X, BarChart3, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "agentops_demo_banner_dismissed";
const DEMO_SESSION_KEY = "agentops_demo_session";

export function DemoModeBanner() {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to avoid flash
  const [isDemo, setIsDemo] = useState(false);
  const [isSharedDemo, setIsSharedDemo] = useState(false);

  useEffect(() => {
    // Check if demo mode is enabled via env
    const envDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    
    // Check if user came via /demo route (shared link)
    const sessionDemo = sessionStorage.getItem(DEMO_SESSION_KEY) === "true";
    
    setIsDemo(envDemo || sessionDemo);
    setIsSharedDemo(sessionDemo);
    
    // Check localStorage for dismissal (only if not shared demo)
    const dismissed = sessionStorage.getItem(STORAGE_KEY) === "true";
    // Never dismiss for shared demo - they need to see it's demo data
    setIsDismissed(sessionDemo ? false : dismissed);
  }, []);

  const handleDismiss = () => {
    // Don't allow dismissal for shared demo links
    if (isSharedDemo) return;
    
    sessionStorage.setItem(STORAGE_KEY, "true");
    setIsDismissed(true);
  };

  if (!isDemo || isDismissed) {
    return null;
  }

  return (
    <div className="bg-amber-500/90 text-amber-950 px-4 py-2.5 relative z-50">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 justify-center">
          {isSharedDemo ? (
            <Lock className="h-4 w-4 flex-shrink-0" />
          ) : (
            <BarChart3 className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">
            {isSharedDemo 
              ? "Demo Mode — Explore with sample data. Sign up to monitor your own agents."
              : "You're viewing demo data — Install the SDK to see your own agents"}
          </span>
          <Link href={isSharedDemo ? "/register" : "/onboarding"}>
            <Button 
              size="sm" 
              variant="secondary"
              className="h-7 bg-amber-950 text-amber-100 hover:bg-amber-900 hover:text-amber-50 gap-1.5"
            >
              {isSharedDemo ? "Sign Up Free" : "Get Started"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        {!isSharedDemo && (
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-amber-600/50 rounded transition-colors flex-shrink-0"
            aria-label="Dismiss demo mode banner"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
