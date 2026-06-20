import { useState } from "react";
import { useNotif } from "./NotificationContext";
import { useTheme } from "./ThemeContext";

/* ─────────────────────────────────────────
   Toast Stack — bottom of screen
───────────────────────────────────────── */
export function ToastStack() {
  const { toasts, dismissToast } = useNotif();

  return (
    <div style={{
      position: "fixed",
      bottom: "80px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9000,
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      width: "calc(100% - 32px)",
      maxWidth: "480px",
      pointerEvents: "none",
    }}>
      {toasts.map(toast => (
        <div key={toast.id}
          onClick={() => dismissToast(toast.id)}
          style={{
            background: toast.color || "#1565c0",
            color: "#fff",
            borderRadius: "12px",
            padding: "12px 16px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            pointerEvents: "all",
            cursor: "pointer",
            animation: "slideUp 0.3s ease",
          }}>
          <span style={{ fontSize: "20px", flexShrink: 0 }}>{toast.icon || "🔔"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "700", fontSize: "14px" }}>{toast.title}</div>
            {toast.body && <div style={{ fontSize: "12px", opacity: 0.9, marginTop: "2px" }}>{toast.body}</div>}
          </div>
          <button style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: "22px", height: "22px", color: "#fff", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      ))}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────
   Notification Bell Icon + Drawer
───────────────────────────────────────── */
export function NotificationBell() {
  const { unreadCount, history, markAllRead, clearHistory } = useNotif();
  const { t } = useTheme();
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    markAllRead();
  };

  return (
    <>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.2)",
          border: "none",
          borderRadius: "50%",
          width: "36px", height: "36px",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "18px",
        }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: "-2px", right: "-2px",
            background: "#f44336",
            color: "#fff",
            borderRadius: "50%",
            width: "18px", height: "18px",
            fontSize: "10px",
            fontWeight: "700",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #1565c0",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Drawer overlay */}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 8000, background: "rgba(0,0,0,0.5)" }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute",
              top: 0, right: 0, bottom: 0,
              width: "min(340px, 100vw)",
              background: t.card,
              boxShadow: "-4px 0 24px rgba(0,0,0,0.2)",
              display: "flex", flexDirection: "column",
              animation: "slideIn 0.25s ease",
            }}
          >
            {/* Header */}
            <div style={{ background: "#1565c0", padding: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "#fff", fontSize: "16px", fontWeight: "700", flex: 1 }}>🔔 Notifications</span>
              {history.length > 0 && (
                <button onClick={clearHistory} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>
                  Clear all
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer" }}>✕</button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: t.subtext }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔕</div>
                  <p style={{ fontWeight: "600" }}>No notifications yet</p>
                  <p style={{ fontSize: "13px", marginTop: "6px" }}>You'll get alerts when your bus is near</p>
                </div>
              ) : (
                history.map((n, i) => (
                  <div key={n.id} style={{
                    padding: "14px 16px",
                    borderBottom: `1px solid ${t.border}`,
                    display: "flex", gap: "12px", alignItems: "flex-start",
                    background: n.read ? "transparent" : (t.pill),
                  }}>
                    <span style={{ fontSize: "22px", flexShrink: 0 }}>{n.icon || "🔔"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "700", fontSize: "14px", color: t.text }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: "12px", color: t.subtext, marginTop: "3px" }}>{n.body}</div>}
                      <div style={{ fontSize: "11px", color: t.subtext, marginTop: "4px" }}>
                        {new Date(n.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {new Date(n.time).toLocaleDateString([], { day: "2-digit", month: "short" })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

/* ─────────────────────────────────────────
   PWA Install Bottom Sheet
   Shows once, slides up from bottom
───────────────────────────────────────── */
export function InstallSheet({ canInstall, triggerInstall, onDismiss }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("pwa_install_dismissed") === "1"
  );
  const { t } = useTheme();

  if (!canInstall || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem("pwa_install_dismissed", "1");
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      zIndex: 8500,
      animation: "sheetUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      {/* Scrim */}
      <div onClick={dismiss} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: -1 }} />

      <div style={{
        background: t.card,
        borderRadius: "20px 20px 0 0",
        padding: "20px 20px 32px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
        maxWidth: "520px",
        margin: "0 auto",
      }}>
        {/* Handle bar */}
        <div style={{ width: "40px", height: "4px", background: t.border, borderRadius: "2px", margin: "0 auto 16px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
          <img src="/icons/icon-192.png" alt="App icon"
            style={{ width: "56px", height: "56px", borderRadius: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} />
          <div>
            <div style={{ fontWeight: "800", fontSize: "17px", color: t.text }}>Where Is My Bus</div>
            <div style={{ fontSize: "13px", color: t.subtext, marginTop: "2px" }}>Add to your home screen</div>
          </div>
        </div>

        <p style={{ fontSize: "13px", color: t.subtext, marginBottom: "18px", lineHeight: "1.6" }}>
          Install this app for instant access — track buses, get arrival alerts, and view routes even with slow internet.
        </p>

        {/* Feature pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
          {["📍 Live tracking", "🔔 Alerts", "🌙 Dark mode", "⚡ Fast"].map(f => (
            <span key={f} style={{ background: "#e3f2fd", color: "#1565c0", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>{f}</span>
          ))}
        </div>

        <button onClick={triggerInstall} style={{
          width: "100%", padding: "15px",
          background: "#1565c0", color: "#fff",
          border: "none", borderRadius: "12px",
          fontSize: "16px", fontWeight: "700", cursor: "pointer",
          marginBottom: "10px",
        }}>
          📲 Add to Home Screen
        </button>

        <button onClick={dismiss} style={{
          width: "100%", padding: "12px",
          background: "transparent", color: t.subtext,
          border: "none", fontSize: "14px", cursor: "pointer",
        }}>
          Not now
        </button>
      </div>

      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────
   Permission Request Card
   Show once to ask for notification permission
───────────────────────────────────────── */
export function NotifPermissionCard({ onAllow, onSkip }) {
  const { t } = useTheme();

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      zIndex: 8400,
      animation: "sheetUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      <div onClick={onSkip} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: -1 }} />
      <div style={{
        background: t.card,
        borderRadius: "20px 20px 0 0",
        padding: "20px 20px 32px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
        maxWidth: "520px",
        margin: "0 auto",
      }}>
        <div style={{ width: "40px", height: "4px", background: t.border, borderRadius: "2px", margin: "0 auto 16px" }} />

        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <div style={{ fontSize: "48px", marginBottom: "10px" }}>🔔</div>
          <div style={{ fontWeight: "800", fontSize: "17px", color: t.text }}>Enable Bus Alerts</div>
          <div style={{ fontSize: "13px", color: t.subtext, marginTop: "6px", lineHeight: "1.6" }}>
            Get notified when your bus is nearby, running late, or when a driver sends an SOS alert.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          {[
            ["🚌", "Bus approaching your stop (2 stops away)"],
            ["⏱️", "Running late alerts"],
            ["🆘", "Emergency SOS alerts from driver"],
            ["🛑", "Bus breakdown notifications"],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }}>{icon}</span>
              <span style={{ fontSize: "13px", color: t.subtext }}>{text}</span>
            </div>
          ))}
        </div>

        <button onClick={onAllow} style={{
          width: "100%", padding: "15px",
          background: "#2e7d32", color: "#fff",
          border: "none", borderRadius: "12px",
          fontSize: "16px", fontWeight: "700", cursor: "pointer",
          marginBottom: "10px",
        }}>
          🔔 Allow Notifications
        </button>

        <button onClick={onSkip} style={{
          width: "100%", padding: "12px",
          background: "transparent", color: t.subtext,
          border: "none", fontSize: "14px", cursor: "pointer",
        }}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
