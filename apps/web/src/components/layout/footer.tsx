"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-4 px-6 mt-auto">
      <div className="flex items-center justify-center gap-4 text-xs text-zinc-500">
        <span className="font-medium">AgentOps Observer</span>
        <span className="text-zinc-700">·</span>
        <Link
          href="https://docs.agentops.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-400 transition-colors"
        >
          Docs
        </Link>
        <span className="text-zinc-700">·</span>
        <Link
          href="https://status.agentops.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-400 transition-colors"
        >
          Status
        </Link>
        <span className="text-zinc-700">·</span>
        <Link
          href="/privacy"
          className="hover:text-zinc-400 transition-colors"
        >
          Privacy
        </Link>
        <span className="text-zinc-700">·</span>
        <Link
          href="/terms"
          className="hover:text-zinc-400 transition-colors"
        >
          Terms
        </Link>
      </div>
    </footer>
  );
}
