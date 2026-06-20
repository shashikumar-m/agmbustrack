import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useTheme } from "../ThemeContext";

import { API } from "../config.js";

// Human-readable last-seen
function lastSeenText(lastUpdated) {
  const mins = Math.floor((Date.now() - new Date(lastUpdated)) / 60000);
  if (mins < 1)  return { text: "Just now",          live: true  };
  if (mins < 2)  return { text: "< 1 min ago",       live: true  };
  if (mins < 60) return { text: `${mins} min ago`,   live: false };
  const hrs = Math.floor(mins / 60);
  return { text: `${hrs}h ago`, live: false };
}

export default function SearchResultsPage() {
  const navigate = useNavigate();
  const { dark, t } = useTheme();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [lastFetch, setLastFetch] = useState(null);

  useEffect(() => {
    if (from && to) fetchResults();
    const iv = setInterval(fetchResults, 15000);
    return () => clearInterval(iv);
  }, [from, to]);

  const fetchResults = async () => {
    try {
      const res = await axios.get(`${API}/student/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setResults(res.data);
      setError("");
      setLastFetch(new Date());
    } catch { setError("Failed to fetch bus data"); }
    finally   { setLoading(false); }
  };

  const liveBuses    = results.flatMap(r => r.liveBuses.map(b => ({ ...b, routeObj: r.route })));
  const offlineRoutes = results.filter(r => r.liveBuses.length === 0);
  const abbr = n => n ? n.substring(0, 3).toUpperCase() : "?";

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "sans-serif", transition: "background 0.3s" }}>

      {/* Header */}
      <div style={{ background: "#1565c0", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: "10px" }}>
          <button onClick={() => navigate("/student")} style={{ background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer" }}>←</button>
          <span style={{ color: "#fff", fontSize: "16px", fontWeight: "700", flex: 1 }}>Search results</span>
          {lastFetch && <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "11px" }}>Updated {new Date(lastFetch).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>

        {/* Route strip */}
        <div style={{ background: "rgba(0,0,0,0.18)", padding: "9px 14px 11px", display: "flex", alignItems: "center", gap: "8px" }}>
          <StopChip abbr={abbr(from)} full={from} />
          <span style={{ color: "#fff", fontSize: "16px" }}>→</span>
          <StopChip abbr={abbr(to)} full={to} />
          <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.65)", fontSize: "11px" }}>Auto-refresh 15s</span>
        </div>
      </div>

      <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        {loading ? (
          <Center><div style={{ fontSize: "32px" }}>🔄</div><p style={{ color: t.subtext, marginTop: "10px" }}>Searching buses...</p></Center>
        ) : error ? (
          <Center>
            <p style={{ color: "#d32f2f", fontWeight: "600" }}>⚠️ {error}</p>
            <button onClick={fetchResults} style={retryBtn}>Retry</button>
          </Center>
        ) : liveBuses.length === 0 && offlineRoutes.length === 0 ? (
          <NoBus from={from} to={to} t={t} />
        ) : (
          <>
            {liveBuses.length > 0 && (
              <div style={{ padding: "10px 14px 4px" }}>
                <span style={{ fontSize: "12px", color: t.subtext, fontWeight: "600" }}>
                  {liveBuses.length} BUS{liveBuses.length > 1 ? "ES" : ""} FOUND
                </span>
              </div>
            )}
            {liveBuses.map(bus => (
              <BusCard key={bus._id || bus.busNumber} bus={bus} from={from} to={to} t={t} dark={dark}
                onClick={() => navigate(`/track/${bus.busNumber}`)} />
            ))}
            {offlineRoutes.map(r => <OfflineCard key={r.route._id} route={r.route} t={t} />)}
          </>
        )}

        {/* Bottom bar */}
        <div style={{ background: t.card, borderTop: `1px solid ${t.border}`, padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", bottom: 0 }}>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#1565c0" }}>Check all live buses</span>
          <span style={{ color: "#1565c0", fontSize: "20px" }}>›</span>
        </div>
      </div>
    </div>
  );
}

function BusCard({ bus, from, to, t, dark, onClick }) {
  const { text: seenText, live: isLive } = lastSeenText(bus.lastUpdated);
  const abbr = n => n ? n.substring(0, 3).toUpperCase() : "?";
  const eta = bus.eta;

  return (
    <button onClick={onClick} style={{
      width: "100%", background: t.card, border: "none",
      borderBottom: `1px solid ${t.border}`,
      padding: "14px", cursor: "pointer", textAlign: "left", display: "block",
    }}>
      {/* Row 1: badge + live + route abbr */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{ background: isLive ? "#1565c0" : "#9e9e9e", color: "#fff", padding: "3px 8px", borderRadius: "4px", fontSize: "13px", fontWeight: "700" }}>
          {bus.busNumber}
        </span>
        <span style={{ fontSize: "13px", flex: 1, fontWeight: "600", color: isLive ? "#2e7d32" : t.orange }}>
          {isLive ? "● LIVE" : `⏱ ${seenText}`}
        </span>
        <span style={{ fontSize: "12px", color: t.subtext, fontWeight: "600" }}>{abbr(from)} → {abbr(to)}</span>
        <span style={{ color: "#1565c0", fontSize: "18px" }}>›</span>
      </div>

      {/* Row 2: route name */}
      <div style={{ fontSize: "14px", color: t.text, fontWeight: "600", marginBottom: "4px" }}>
        {bus.routeObj?.routeName || bus.route}
      </div>

      {/* Status badge */}
      {bus.busStatus && bus.busStatus !== "on_time" && (
        <StatusBadge status={bus.busStatus} />
      )}

      {/* ETA banner */}
      {eta && isLive && (
        <div style={{
          margin: "8px 0 4px",
          background: eta.etaMins <= 5 ? "#fff3e0" : "#e8f5e9",
          border: `1px solid ${eta.etaMins <= 5 ? "#ff9800" : "#4caf50"}`,
          borderRadius: "6px", padding: "6px 10px",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span style={{ fontSize: "16px" }}>{eta.etaMins <= 5 ? "🔔" : "⏱️"}</span>
          <div>
            <span style={{ fontWeight: "700", fontSize: "13px", color: eta.etaMins <= 5 ? "#e65100" : "#2e7d32" }}>
              ETA to {to}: ~{eta.etaMins} min
            </span>
            <span style={{ fontSize: "11px", color: t.subtext, marginLeft: "6px" }}>
              ({eta.stopsAway} stop{eta.stopsAway !== 1 ? "s" : ""} away · {eta.distKm} km)
            </span>
          </div>
        </div>
      )}

      {/* Last seen indicator when not live */}
      {!isLive && (
        <div style={{ fontSize: "12px", color: t.subtext, margin: "4px 0" }}>
          🕐 Last seen at <strong>{bus.currentStop || "unknown"}</strong> · {seenText}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
        <Pill label="At"    value={bus.currentStop || "En route"} t={t} />
        <Pill label="Next"  value={bus.nextStop || "—"} t={t} />
        <Pill label="Speed" value={`${Math.round(bus.speed || 0)} km/h`} t={t} />
      </div>
    </button>
  );
}

function OfflineCard({ route, t }) {
  return (
    <div style={{ background: t.card, borderBottom: `1px solid ${t.border}`, padding: "13px 14px", opacity: 0.6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ background: "#9e9e9e", color: "#fff", padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "700" }}>ROUTE</span>
        <span style={{ fontSize: "14px", color: t.text, fontWeight: "600" }}>{route.routeName}</span>
      </div>
      <div style={{ fontSize: "12px", color: "#e65100", marginTop: "4px" }}>No bus currently running on this route</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { delayed: ["🟡 Running Late","#f57c00","#fff8e1"], bus_full: ["🔴 Bus Full","#c62828","#ffebee"], breakdown: ["⚠️ Breakdown","#b71c1c","#ffebee"] };
  const s = map[status]; if (!s) return null;
  return <span style={{ background: s[2], color: s[1], padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", marginBottom: "4px", display: "inline-block" }}>{s[0]}</span>;
}

function Pill({ label, value, t }) {
  return (
    <div style={{ background: t.pill, borderRadius: "5px", padding: "5px 9px", marginRight: "4px" }}>
      <div style={{ fontSize: "10px", color: t.pillText, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
      <div style={{ fontSize: "12px", fontWeight: "700", color: t.text, marginTop: "1px" }}>{value}</div>
    </div>
  );
}

function StopChip({ abbr, full }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ background: "#fff", color: "#1565c0", padding: "2px 7px", borderRadius: "4px", fontSize: "12px", fontWeight: "700" }}>{abbr}</span>
      <span style={{ color: "#fff", fontSize: "14px", fontWeight: "500" }}>{full}</span>
    </span>
  );
}

function NoBus({ from, to, t }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: "48px", marginBottom: "14px" }}>🚌</div>
      <p style={{ fontWeight: "700", fontSize: "16px", color: t.text, marginBottom: "8px" }}>No buses found</p>
      <p style={{ color: t.subtext, fontSize: "14px" }}>No route found for <strong>{from}</strong> → <strong>{to}</strong></p>
    </div>
  );
}

function Center({ children }) {
  return <div style={{ textAlign: "center", padding: "60px 20px" }}>{children}</div>;
}

const retryBtn = { marginTop: "14px", padding: "10px 24px", background: "#1565c0", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" };

