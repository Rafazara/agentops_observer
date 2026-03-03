"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/use-toast";

interface DemoModeContextType {
  isDemoMode: boolean;
  isRestricted: (action: string) => boolean;
  showDemoToast: (action: string) => void;
  wrapAction: <T extends (...args: unknown[]) => unknown>(
    action: string,
    fn: T
  ) => T | (() => void);
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(
  undefined
);

const DEMO_SESSION_KEY = "agentops_demo_session";

// Actions that are restricted in demo mode
const RESTRICTED_ACTIONS = new Set([
  "acknowledge_incident",
  "resolve_incident",
  "create_alert_rule",
  "update_alert_rule",
  "delete_alert_rule",
  "create_api_key",
  "delete_api_key",
  "update_settings",
  "invite_team_member",
  "remove_team_member",
  "update_role",
  "connect_integration",
  "disconnect_integration",
]);

// Friendly names for actions
const ACTION_LABELS: Record<string, string> = {
  acknowledge_incident: "Acknowledge incidents",
  resolve_incident: "Resolve incidents",
  create_alert_rule: "Create alert rules",
  update_alert_rule: "Update alert rules",
  delete_alert_rule: "Delete alert rules",
  create_api_key: "Generate API keys",
  delete_api_key: "Delete API keys",
  update_settings: "Update settings",
  invite_team_member: "Invite team members",
  remove_team_member: "Remove team members",
  update_role: "Update roles",
  connect_integration: "Connect integrations",
  disconnect_integration: "Disconnect integrations",
};

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check environment variable
    const envDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    
    // Check session storage
    const sessionDemo = typeof window !== "undefined" 
      ? sessionStorage.getItem(DEMO_SESSION_KEY) === "true"
      : false;
    
    setIsDemoMode(envDemo || sessionDemo);
  }, []);

  const isRestricted = useCallback(
    (action: string) => {
      return isDemoMode && RESTRICTED_ACTIONS.has(action);
    },
    [isDemoMode]
  );

  const showDemoToast = useCallback(
    (action: string) => {
      const actionLabel = ACTION_LABELS[action] || action.replace(/_/g, " ");
      
      toast({
        title: "Demo Mode",
        description: `${actionLabel} is not available in demo mode. Sign up to unlock all features.`,
        type: "info",
        duration: 5000,
        action: {
          label: "Sign Up",
          onClick: () => {
            window.location.href = "/register";
          },
        },
      });
    },
    [toast]
  );

  const wrapAction = useCallback(
    <T extends (...args: unknown[]) => unknown>(action: string, fn: T): T | (() => void) => {
      if (isRestricted(action)) {
        return (() => {
          showDemoToast(action);
        }) as unknown as T;
      }
      return fn;
    },
    [isRestricted, showDemoToast]
  );

  return (
    <DemoModeContext.Provider
      value={{ isDemoMode, isRestricted, showDemoToast, wrapAction }}
    >
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error("useDemoMode must be used within a DemoModeProvider");
  }
  return context;
}

// HOC to wrap components that need demo mode awareness
export function withDemoRestriction<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  action: string
) {
  return function DemoRestrictedComponent(props: P) {
    const { isRestricted, showDemoToast } = useDemoMode();
    
    if (isRestricted(action)) {
      return (
        <div 
          onClick={() => showDemoToast(action)}
          className="cursor-not-allowed"
        >
          <WrappedComponent {...props} />
        </div>
      );
    }
    
    return <WrappedComponent {...props} />;
  };
}
