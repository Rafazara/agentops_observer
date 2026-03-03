"use client";

import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X, Command } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface Shortcut {
  keys: string[];
  description: string;
  action?: () => void;
}

interface KeyboardContextValue {
  showHelp: () => void;
  hideHelp: () => void;
  isHelpOpen: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SHORTCUTS: Record<string, Shortcut> = {
  "g d": { keys: ["G", "D"], description: "Go to Dashboard" },
  "g e": { keys: ["G", "E"], description: "Go to Executions" },
  "g a": { keys: ["G", "A"], description: "Go to Agents" },
  "g c": { keys: ["G", "C"], description: "Go to Costs" },
  "g i": { keys: ["G", "I"], description: "Go to Incidents" },
  "g l": { keys: ["G", "L"], description: "Go to Alerts" },
  "g s": { keys: ["G", "S"], description: "Go to Settings" },
  "?": { keys: ["?"], description: "Show keyboard shortcuts" },
  "Escape": { keys: ["Esc"], description: "Close modal / panel" },
};

// ============================================================================
// CONTEXT
// ============================================================================

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function useKeyboard() {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error("useKeyboard must be used within KeyboardProvider");
  }
  return context;
}

// ============================================================================
// HELP MODAL
// ============================================================================

function ShortcutsModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const navigationShortcuts = Object.entries(SHORTCUTS).filter(([key]) => key.startsWith("g"));
  const generalShortcuts = Object.entries(SHORTCUTS).filter(([key]) => !key.startsWith("g"));

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-[100]"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-0 flex items-center justify-center z-[101] p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <div 
          className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <h2 id="shortcuts-title" className="text-lg font-semibold flex items-center gap-2">
              <Command className="h-5 w-5 text-muted-foreground" />
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
              aria-label="Close shortcuts modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Navigation */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Navigation
              </h3>
              <div className="space-y-2">
                {navigationShortcuts.map(([, shortcut]) => (
                  <div key={shortcut.description} className="flex items-center justify-between">
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-muted-foreground mx-1">then</span>}
                          <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                General
              </h3>
              <div className="space-y-2">
                {generalShortcuts.map(([, shortcut]) => (
                  <div key={shortcut.description} className="flex items-center justify-between">
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd key={i} className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-800 text-center">
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] font-mono">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// PROVIDER
// ============================================================================

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const showHelp = useCallback(() => setIsHelpOpen(true), []);
  const hideHelp = useCallback(() => setIsHelpOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Handle Escape
      if (e.key === "Escape") {
        setIsHelpOpen(false);
        // Dispatch event for other modals to listen
        window.dispatchEvent(new CustomEvent("keyboard:escape"));
        return;
      }

      // Handle ? for help
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsHelpOpen(true);
        return;
      }

      // Handle g + key sequences
      if (pendingKey === "g") {
        e.preventDefault();
        const key = e.key.toLowerCase();
        
        const routes: Record<string, string> = {
          d: "/",
          e: "/executions",
          a: "/agents",
          c: "/costs",
          i: "/incidents",
          l: "/alerts",
          s: "/settings",
        };

        if (routes[key]) {
          router.push(routes[key]);
        }
        
        setPendingKey(null);
        return;
      }

      // Start g sequence
      if (e.key === "g") {
        setPendingKey("g");
        // Clear after timeout
        setTimeout(() => setPendingKey(null), 1000);
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pendingKey, router]);

  return (
    <KeyboardContext.Provider value={{ showHelp, hideHelp, isHelpOpen }}>
      {children}
      <ShortcutsModal isOpen={isHelpOpen} onClose={hideHelp} />
      
      {/* Pending key indicator */}
      {pendingKey && (
        <div className="fixed bottom-6 left-6 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
            <span className="text-sm text-muted-foreground mr-2">Shortcut:</span>
            <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
              {pendingKey.toUpperCase()}
            </kbd>
          </div>
        </div>
      )}
    </KeyboardContext.Provider>
  );
}
