import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../ThemeContext";
import { usePWAInstall } from "../usePWAInstall";
import { useNotif } from "../NotificationContext";
import { InstallSheet, NotifPermissionCard, NotificationBell } from "../NotificationUI";

const DRIVER_PASSWORD = "driver123";
const ADMIN_PASSWORD  = "admin123";

export default function HomePage() {
  const navigate = useNavigate();
  const { dark, toggle, t } = useTheme();
  const { canInstall, triggerInstall } = usePWAInstall();
  const { permission, requestPermission, supported } = useNotif();

  const [modal, setModal]         = useState(null);
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [showPwd, setShowPwd]     = useState(false);

  // Show install sheet after 2s if not yet installed/dismissed
  const [showInstall, setShowInstall] = useState(false);
  // Show notification permission card after install sheet is handled
  const [showNotifCard, setShowNotifCard] = useState(false);

  useEffect(() => {
    // 2s delay before showing install prompt
    const t1 = setTimeout(() => {
      if (canInstall) setShowInstall(true);
    }, 2000);
    return () => clearTimeout(t1);
  }, [canInstall]);

  useEffect(() => {
    // Show notification permission card if permission not yet asked
    if (supported && permission === "default") {
      const t2 = setTimeout(() => {
        if (!showInstall) setShowNotifCard(true);
      }, 3000);
      return () => clearTimeout(t2);
    }
  }, [permission, supported, showInstall]);

  const handleInstallDismiss = () => {
    setShowInstall(false);
    // After install prompt handled, show notification prompt
    if (supported && permission === "default") {
      setTimeout(() => setShowNotifCard(true), 600);
    }
  };

  const handleInstallAccept = async () => {
    await triggerInstall();
    setShowInstall(false);
    if (supported && permission === "default") {
      setTimeout(() => setShowNotifCard(true), 600);
    }
  };

  const handleAllowNotif = async () => {
    await requestPermission();
    setShowNotifCard(false);
  };

  const openModal = (role) => {
    setModal(role); setPassword(""); setError(""); setShowPwd(false);
  };

  const handleLogin = () => {
    const correct = modal === "driver" ? DRIVER_PASSWORD : ADMIN_PASSWORD;
    if (password === correct) {
      sessionStorage.setItem("role", modal);
      navigate(modal === "driver" ? "/driver" : "/admin");
    } else {
      setError("Wrong password. Try again.");
      setPassword("");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: dark
        ? "linear-gradient(160deg, #0d1b2a 0%, #0f1117 60%, #1a1d27 100%)"
        : "linear-gradient(160deg, #1565c0 0%, #0d47a1 60%, #1a237e 100%)",
      fontFamily: "sans-serif",
      transition: "background 0.3s",
    }}>

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <RoleChip label="🚗 Driver" onClick={() => openModal("driver")} />
          <RoleChip label="🛠️ Admin"  onClick={() => openModal("admin")}  />
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <NotificationBell />
          <button onClick={toggle} style={{
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
            color: "#fff", padding: "6px 12px", borderRadius: "20px",
            fontSize: "14px", cursor: "pointer",
          }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "24px 20px 16px", color: "#fff" }}>
        <div style={{ fontSize: "76px", lineHeight: 1, marginBottom: "10px" }}>🚌</div>
        <h1 style={{ fontSize: "26px", fontWeight: "800", margin: "0 0 6px" }}>Where Is My Bus</h1>
        <p style={{ fontSize: "14px", opacity: 0.75, margin: 0 }}>Real-time college bus tracking</p>
      </div>

      {/* Student card */}
      <div style={{ padding: "16px 20px 40px", maxWidth: "440px", margin: "0 auto" }}>
        <div style={{
          background: t.card, borderRadius: "16px", padding: "24px 20px",
          boxShadow: dark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.25)",
        }}>
          <div style={{ textAlign: "center", marginBottom: "18px" }}>
            <span style={{ fontSize: "36px" }}>🎓</span>
            <h2 style={{ fontSize: "18px", fontWeight: "700", margin: "8px 0 4px", color: t.text }}>
              Student Tracker
            </h2>
            <p style={{ color: t.subtext, fontSize: "13px", margin: 0 }}>
              Search and track your college buses live
            </p>
          </div>

          <button onClick={() => navigate("/student")} style={{
            width: "100%", padding: "14px",
            background: "#1565c0", color: "#fff",
            border: "none", borderRadius: "10px",
            fontSize: "15px", fontWeight: "700", cursor: "pointer",
          }}>
            🔍 Find My Bus
          </button>

          {/* Notification permission inline — if not yet granted */}
          {supported && permission === "default" && (
            <button
              onClick={handleAllowNotif}
              style={{
                width: "100%", marginTop: "10px", padding: "11px",
                background: "#e8f5e9", color: "#2e7d32",
                border: "1px solid #a5d6a7", borderRadius: "10px",
                fontSize: "13px", fontWeight: "600", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}>
              🔔 Enable Bus Alerts
            </button>
          )}

          {supported && permission === "granted" && (
            <div style={{ marginTop: "10px", textAlign: "center", fontSize: "12px", color: t.subtext }}>
              ✅ Bus alerts are enabled
            </div>
          )}

          <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              ["📍", "Live bus location on map"],
              ["⏱️", "ETA — know when bus arrives"],
              ["🌤️", "Live weather at your stop"],
              ["🌙", "Dark mode supported"],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>{icon}</span>
                <span style={{ fontSize: "13px", color: t.subtext }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Password Modal */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px",
        }} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{
            background: t.card, borderRadius: "16px", padding: "26px 22px",
            width: "100%", maxWidth: "340px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}>
            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: modal === "driver" ? "#fff3e0" : "#f3e5f5",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "26px", margin: "0 auto 10px",
              }}>
                {modal === "driver" ? "🚗" : "🛠️"}
              </div>
              <h2 style={{ fontSize: "17px", fontWeight: "700", margin: "0 0 4px", color: t.text }}>
                {modal === "driver" ? "Driver Login" : "Admin Login"}
              </h2>
              <p style={{ color: t.subtext, fontSize: "12px", margin: 0 }}>Enter password to continue</p>
            </div>

            {error && (
              <div style={{ background: "#ffebee", color: "#c62828", padding: "9px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "12px" }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ position: "relative", marginBottom: "12px" }}>
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                autoFocus
                style={{
                  width: "100%", padding: "11px 40px 11px 12px",
                  border: `1.5px solid ${t.inputBorder}`, borderRadius: "8px",
                  fontSize: "14px", outline: "none", boxSizing: "border-box",
                  background: t.input, color: t.text,
                }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "15px" }}>
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: "11px", background: t.pill, color: t.subtext, border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleLogin} style={{ flex: 2, padding: "11px", background: modal === "driver" ? "#e65100" : "#6a1b9a", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>
                Login →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Install Bottom Sheet */}
      {showInstall && (
        <InstallSheet
          canInstall={canInstall}
          triggerInstall={handleInstallAccept}
          onDismiss={handleInstallDismiss}
        />
      )}

      {/* Notification Permission Bottom Sheet */}
      {showNotifCard && !showInstall && (
        <NotifPermissionCard
          onAllow={handleAllowNotif}
          onSkip={() => setShowNotifCard(false)}
        />
      )}
    </div>
  );
}

function RoleChip({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
      color: "#fff", padding: "6px 13px", borderRadius: "20px",
      fontSize: "12px", fontWeight: "600", cursor: "pointer",
    }}>
      {label}
    </button>
  );
}
