"use client";

import { Bell, AlertTriangle, CheckCircle, Info, AlertCircle, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockNotifications } from "@/lib/mock-data";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const iconMap = {
  critical: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  info: Info,
};

const colorMap = {
  critical: "text-[hsl(var(--error))] bg-[hsl(var(--error))]/10",
  warning: "text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10",
  success: "text-[hsl(var(--success))] bg-[hsl(var(--success))]/10",
  info: "text-[hsl(var(--accent-primary))] bg-[hsl(var(--accent-primary))]/10",
};

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5 text-[hsl(var(--text-secondary))]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--error))] text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[380px] rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-surface))] shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border-subtle))]">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[hsl(var(--text-primary))]">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-[hsl(var(--error))]/10 text-[hsl(var(--error))] font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-[hsl(var(--accent-primary))] hover:text-[hsl(var(--accent-primary))]"
                onClick={markAllAsRead}
              >
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 text-[hsl(var(--text-muted))] mx-auto mb-3" />
                <p className="text-sm text-[hsl(var(--text-muted))]">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = iconMap[notification.type as keyof typeof iconMap] || Info;
                const colorClass = colorMap[notification.type as keyof typeof colorMap] || colorMap.info;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex gap-3 p-4 border-b border-[hsl(var(--border-subtle))] last:border-0 hover:bg-[hsl(var(--bg-hover))] transition-colors group cursor-pointer",
                      !notification.read && "bg-[hsl(var(--accent-primary))]/5"
                    )}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", colorClass)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm",
                          notification.read 
                            ? "text-[hsl(var(--text-secondary))]" 
                            : "text-[hsl(var(--text-primary))] font-medium"
                        )}>
                          {notification.title}
                        </p>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[hsl(var(--bg-elevated))] rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                        >
                          <X className="w-3 h-3 text-[hsl(var(--text-muted))]" />
                        </button>
                      </div>
                      <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <Clock className="w-3 h-3 text-[hsl(var(--text-disabled))]" />
                        <span className="text-xs text-[hsl(var(--text-disabled))]">
                          {notification.time}
                        </span>
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-[hsl(var(--accent-primary))] flex-shrink-0 mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-elevated))]">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-8 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
              onClick={() => setIsOpen(false)}
            >
              View all notifications
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
