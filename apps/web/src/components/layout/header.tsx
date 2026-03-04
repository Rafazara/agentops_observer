"use client";

import { Search, User, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiStatusIndicator } from "@/components/api-status";
import { NotificationsDropdown } from "@/components/notifications-dropdown";

export function Header() {
  const openCommandPalette = () => {
    // Simulate Cmd+K to open command palette
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-6">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <button
          onClick={openCommandPalette}
          className="relative flex-1 text-left"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
          <div className="input-field w-full pl-10 pr-16 text-[hsl(var(--text-muted))] cursor-pointer hover:border-[hsl(var(--border-default))]">
            Search executions, agents...
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-[hsl(var(--text-disabled))]">
            <kbd className="px-1.5 py-0.5 rounded bg-[hsl(var(--bg-hover))] border border-[hsl(var(--border-subtle))] font-mono">
              <Command className="h-2.5 w-2.5 inline" />K
            </kbd>
          </div>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <ApiStatusIndicator />
        <NotificationsDropdown />
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5 text-[hsl(var(--text-secondary))]" />
        </Button>
      </div>
    </header>
  );
}
