"use client";

import { Bell, Search, User, Command } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] px-6">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
          <input
            type="text"
            placeholder="Search executions, agents..."
            className="input-field w-full pl-10 pr-4"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-[hsl(var(--text-disabled))]">
            <kbd className="px-1.5 py-0.5 rounded bg-[hsl(var(--bg-hover))] border border-[hsl(var(--border-subtle))] font-mono">
              <Command className="h-2.5 w-2.5 inline" />K
            </kbd>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-[hsl(var(--text-secondary))]" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--error))] text-[10px] font-semibold text-white">
            3
          </span>
        </Button>
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5 text-[hsl(var(--text-secondary))]" />
        </Button>
      </div>
    </header>
  );
}
