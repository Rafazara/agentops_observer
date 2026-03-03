"use client";

import { useEffect } from "react";

interface PageTitleProps {
  title: string;
  badge?: number;
  badgeType?: "critical" | "warning" | "info";
}

export function PageTitle({ title, badge, badgeType = "critical" }: PageTitleProps) {
  useEffect(() => {
    const baseTitle = "AgentOps Observer";
    
    if (badge && badge > 0) {
      const emoji = badgeType === "critical" ? "🔴" : badgeType === "warning" ? "🟡" : "";
      document.title = `${emoji} ${title} (${badge}) — ${baseTitle}`;
    } else {
      document.title = `${title} — ${baseTitle}`;
    }

    // Cleanup - restore base title on unmount
    return () => {
      document.title = baseTitle;
    };
  }, [title, badge, badgeType]);

  return null;
}
