import { useState, useCallback } from "react";

/**
 * Central notification manager.
 * Handles:
 *  - Browser Push Notification permission
 *  - Sending native notifications (when app is in background)
 *  - In-app toast notifications (when app is in foreground)
 *  - Notification history (bell icon)
 */

const STORAGE_KEY = "bus_notifications";

export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [toasts, setToasts] = useState([]);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  });

  // Ask browser for notification permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // Save to history + show toast + native notification
  const notify = useCallback((title, body, options = {}) => {
    const id = Date.now();
    const entry = { id, title, body, time: new Date().toISOString(), read: false, ...options };

    // Add to in-app history
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, 20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    // Show in-app toast
    setToasts(prev => [...prev, entry]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);

    // Show native notification if permission granted and page is hidden
    if (
      permission === "granted" &&
      typeof Notification !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      try {
        new Notification(title, {
          body,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: options.tag || String(id),
          renotify: true,
          ...options.nativeOptions,
        });
      } catch {}
    }
  }, [permission]);

  const markAllRead = useCallback(() => {
    setHistory(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const unreadCount = history.filter(n => !n.read).length;

  return {
    permission,
    requestPermission,
    notify,
    toasts,
    dismissToast,
    history,
    markAllRead,
    clearHistory,
    unreadCount,
    supported: typeof Notification !== "undefined",
  };
}
