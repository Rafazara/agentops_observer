"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Demo mode cookie/storage key
const DEMO_SESSION_KEY = "agentops_demo_session";

export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    // Set demo session
    sessionStorage.setItem(DEMO_SESSION_KEY, "true");
    
    // Set a cookie for the API to recognize demo requests
    document.cookie = `${DEMO_SESSION_KEY}=true; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days
    
    // Redirect to dashboard
    router.push("/");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <h1 className="text-xl font-semibold">Entering Demo Mode</h1>
        <p className="text-muted-foreground">
          Loading demo data...
        </p>
      </div>
    </div>
  );
}
