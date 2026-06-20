import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useTheme } from "../ThemeContext";

import { API } from "../config.js";
const HISTORY_KEY = "bus_search_history";
const getHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } };
const addHistory = (from, to) => {
  const prev = getHistory().filter(h => !(h.from === from && h.to === to));
  localStorage.setItem(HISTORY_KEY, JSON.stringify([{ from, to, time: Date.now() }, ...prev].slice(0, 5)));
};

// Open-Meteo free weather API — no key needed
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&timezone=auto`;
  const r = await fetch(url);
  const d = await r.json();
  return d.current_weather;
}

const WMO_ICON = {
  0:"☀️",1:"🌤️",2:"⛅",3:"☁️",
  45:"🌫️",48:"🌫️",51:"🌦️",53:"🌦️",55:"🌧️",
  61:"🌧️",63:"🌧️",65:"🌧️",71:"🌨️",73:"🌨️",75:"🌨️",
  80:"🌦️",81:"🌦️",82:"⛈️",95:"⛈️",96:"⛈️",99:"⛈️",
};
const WMO_LABEL = {
  0:"Clear",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
  45:"Foggy",48:"Foggy",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",
  61:"Light rain",63:"Moderate rain",65:"Heavy rain",80:"Rain showers",82:"Violent showers",
  95:"Thunderstorm",
};

export default function StudentPage() {
  const navigate = useNavigate();
  const { dark, toggle, t } = useTheme();
  const [stops, setStops]       = useState([]);
  const [allBuses, setAllBuses]  = useState([]); // for college bus number grid
  const [fromStop, setFromStop]  = useState("");
  const [toStop, setToStop]      = useState("");
  const [busSearch, setBusSearch] = useState("");
  const [history, setHistory]   = useState(getHistory());
  const [weather, setWeather]   = useState(null);

  useEffect(() => {
    axios.get(`${API}/admin/stops`).then(r => setStops(r.data)).catch(() => {});
    axios.get(`${API}/admin/buses`).then(r => setAllBuses(r.data)).catch(() => {});
    // Get weather for user's location
    navigator.geolocation?.getCurrentPosition(pos => {
      fetchWeather(pos.coords.latitude, pos.coords.longitude)
        .then(setWeather).catch(() => {});
    }, () => {
      fetchWeather(15.3647, 75.1240).then(setWeather).catch(() => {});
    });
  }, []);

  const swapStops = () => { setFromStop(toStop); setToStop(fromStop); };

  const handleSearch = () => {
    if (!fromStop || !toStop) { alert("Select both stops"); return; }
    if (fromStop === toStop)  { alert("From and To cannot be the same"); return; }
    addHistory(fromStop, toStop);
    setHistory(getHistory());
    navigate(`/search?from=${encodeURIComponent(fromStop)}&to=${encodeURIComponent(toStop)}`);
  };

  const handleBusSearch = () => {
    if (!busSearch.trim()) return;
    navigate(`/track/${busSearch.trim().toUpperCase()}`);
  };

  // Live bus quick-look for the bus number search box
  const [quickBus, setQuickBus] = useState(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState("");

  const handleBusLookup = async () => {
    const num = busSearch.trim().toUpperCase();
    if (!num) return;
    setQuickLoading(true);
    setQuickError("");
    setQuickBus(null);
    try {
      const res = await axios.get(`${API}/student/live-bus/${num}`);
      setQuickBus(res.data);
    } catch {
      setQuickError(`Bus "${num}" not found or not active`);
    } finally {
      setQuickLoading(false);
    }
  };

  const openGoogleMaps = (lat, lng, label) => {
    // Opens Google Maps with the live bus pin — user can navigate to it
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(label || "Bus")}`;
    window.open(url, "_blank");
  };

  const abbr = n => n ? n.substring(0, 3).toUpperCase() : "";

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "sans-serif", transition: "background 0.3s" }}>

      {/* Header */}
      <div style={{ background: "#1565c0", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer" }}>☰</button>
            <span style={{ color: "#fff", fontSize: "18px", fontWeight: "700" }}>Where is My Bus</span>
          </div>
          <button onClick={toggle} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", fontSize: "15px" }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Weather strip */}
        {weather && (
          <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>{WMO_ICON[weather.weathercode] || "🌡️"}</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px" }}>
              {weather.temperature}°C · {WMO_LABEL[weather.weathercode] || ""}
            </span>
            {weather.windspeed > 20 && (
              <span style={{ color: "#ffcc02", fontSize: "12px", fontWeight: "700" }}>💨 Windy</span>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 12px", maxWidth: "520px", margin: "0 auto" }}>

        {/* From / To card */}
        <div style={{ background: t.card, borderRadius: "10px", padding: "16px 14px 14px", boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.4)" : "0 1px 6px rgba(0,0,0,0.12)", marginBottom: "12px" }}>

          {/* From */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "13px", height: "13px", borderRadius: "50%", border: `2.5px solid ${t.subtext}`, flexShrink: 0 }} />
            <select value={fromStop} onChange={e => setFromStop(e.target.value)}
              style={{ flex: 1, padding: "10px 8px", border: `1px solid ${t.inputBorder}`, borderRadius: "6px", fontSize: "14px", background: t.input, color: t.text, outline: "none" }}>
              <option value="">Select Boarding Stop</option>
              {stops.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
            </select>
            {fromStop && <button onClick={() => setFromStop("")} style={{ background: "none", border: "none", color: t.subtext, fontSize: "16px", cursor: "pointer" }}>✕</button>}
          </div>

          {/* Dotted connector */}
          <div style={{ display: "flex", alignItems: "center", margin: "4px 0 4px 5px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginRight: "auto" }}>
              {[0,1,2].map(i => <div key={i} style={{ width: "2px", height: "5px", background: t.subtext, borderRadius: "1px" }} />)}
            </div>
            <button onClick={swapStops} style={{ background: t.pill, border: `1px solid ${t.border}`, borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", fontSize: "16px", color: t.subtext, display: "flex", alignItems: "center", justifyContent: "center" }}>⇅</button>
          </div>

          {/* To */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "13px", height: "13px", borderRadius: "50%", background: t.subtext, flexShrink: 0 }} />
            <select value={toStop} onChange={e => setToStop(e.target.value)}
              style={{ flex: 1, padding: "10px 8px", border: `1px solid ${t.inputBorder}`, borderRadius: "6px", fontSize: "14px", background: t.input, color: t.text, outline: "none" }}>
              <option value="">Select Destination Stop</option>
              {stops.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
            </select>
            {toStop && <button onClick={() => setToStop("")} style={{ background: "none", border: "none", color: t.subtext, fontSize: "16px", cursor: "pointer" }}>✕</button>}
          </div>

          <button onClick={handleSearch} style={{ width: "100%", marginTop: "14px", padding: "13px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: "6px", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>
            Find Buses
          </button>
        </div>

        {/* ── College Bus Number Grid ── */}
        {allBuses.filter(b => b.collegeNumber).length > 0 && (
          <div style={{
            background: t.card, borderRadius: "10px",
            padding: "12px 14px 14px",
            boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.4)" : "0 1px 6px rgba(0,0,0,0.12)",
            marginBottom: "12px",
          }}>
            <p style={{ fontSize: "12px", fontWeight: "700", color: t.subtext, letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: "10px" }}>
              🚌 Track by Bus Number
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
              {allBuses
                .filter(b => b.collegeNumber)
                .sort((a, b) => a.collegeNumber - b.collegeNumber)
                .map(bus => (
                  <button
                    key={bus._id}
                    onClick={() => navigate(`/track/${bus.busNumber}`)}
                    style={{
                      background: "#1565c0",
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      padding: "10px 4px 8px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <span style={{ fontSize: "18px", lineHeight: 1 }}>🚌</span>
                    <span style={{ fontSize: "16px", fontWeight: "800", lineHeight: 1 }}>
                      {bus.collegeNumber}
                    </span>
                  </button>
                ))}
            </div>
            <p style={{ fontSize: "11px", color: t.subtext, marginTop: "8px", textAlign: "center" }}>
              Tap any bus number to track it live
            </p>
          </div>
        )}

        {/* Bus number search */}
        <div style={{ background: t.card, borderRadius: "10px", padding: "10px 14px", boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.4)" : "0 1px 6px rgba(0,0,0,0.12)", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>🚌</span>
            <input
              type="text" placeholder="Enter Bus Number (e.g. KA25F1001)"
              value={busSearch} onChange={e => { setBusSearch(e.target.value); setQuickBus(null); setQuickError(""); }}
              onKeyDown={e => e.key === "Enter" && handleBusLookup()}
              style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: t.text, background: "transparent" }}
            />
            {busSearch && (
              <button onClick={() => { setBusSearch(""); setQuickBus(null); setQuickError(""); }}
                style={{ background: "none", border: "none", color: t.subtext, fontSize: "16px", cursor: "pointer" }}>✕</button>
            )}
            <button onClick={handleBusLookup}
              style={{ background: "#2e7d32", border: "none", borderRadius: "6px", width: "36px", height: "36px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
              🔍
            </button>
          </div>

          {/* Loading */}
          {quickLoading && (
            <div style={{ padding: "12px 4px", fontSize: "13px", color: t.subtext }}>🔄 Looking up bus...</div>
          )}

          {/* Error */}
          {quickError && (
            <div style={{ marginTop: "10px", padding: "10px 12px", background: "#ffebee", borderRadius: "8px", fontSize: "13px", color: "#c62828" }}>
              ⚠️ {quickError}
            </div>
          )}

          {/* Quick bus card */}
          {quickBus && (
            <div style={{ marginTop: "12px", borderTop: `1px solid ${t.border}`, paddingTop: "12px" }}>
              {/* Bus info row */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span style={{ background: "#1565c0", color: "#fff", padding: "3px 9px", borderRadius: "4px", fontSize: "13px", fontWeight: "700" }}>
                  {quickBus.busNumber}
                </span>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#2e7d32" }}>● LIVE</span>
              </div>

              <div style={{ fontSize: "13px", color: t.subtext, marginBottom: "4px" }}>
                🚗 Driver: <strong style={{ color: t.text }}>{quickBus.driverName}</strong>
              </div>
              <div style={{ fontSize: "13px", color: t.subtext, marginBottom: "4px" }}>
                🛣️ Route: <strong style={{ color: t.text }}>{quickBus.route}</strong>
              </div>
              <div style={{ fontSize: "13px", color: t.subtext, marginBottom: "12px" }}>
                📍 At: <strong style={{ color: t.text }}>{quickBus.currentStop || "En route"}</strong>
                {quickBus.nextStop && <span> → {quickBus.nextStop}</span>}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                {/* Track in app */}
                <button
                  onClick={() => navigate(`/track/${quickBus.busNumber}`)}
                  style={{
                    flex: 1, padding: "10px 8px",
                    background: "#1565c0", color: "#fff",
                    border: "none", borderRadius: "8px",
                    fontSize: "13px", fontWeight: "700", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  }}>
                  🚌 Track Live
                </button>

                {/* View in Google Maps */}
                {quickBus.latitude && quickBus.longitude && (
                  <button
                    onClick={() => openGoogleMaps(quickBus.latitude, quickBus.longitude, `Bus ${quickBus.busNumber}`)}
                    style={{
                      flex: 1, padding: "10px 8px",
                      background: "#fff",
                      border: "2px solid #1565c0",
                      borderRadius: "8px",
                      fontSize: "13px", fontWeight: "700", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      color: "#1565c0",
                    }}>
                    <img
                      src="https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                      alt="" style={{ width: "16px", height: "16px" }}
                      onError={e => e.target.style.display = "none"}
                    />
                    Google Maps
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search history */}
        {history.length > 0 && (
          <div style={{ background: t.card, borderRadius: "10px", padding: "10px 0", boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.4)" : "0 1px 6px rgba(0,0,0,0.12)" }}>
            <div style={{ padding: "4px 14px 10px", fontSize: "12px", fontWeight: "700", color: t.subtext, letterSpacing: "0.8px" }}>SEARCH HISTORY</div>
            {history.map((h, i) => (
              <button key={i}
                onClick={() => navigate(`/search?from=${encodeURIComponent(h.from)}&to=${encodeURIComponent(h.to)}`)}
                style={{ width: "100%", background: "none", border: "none", padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", borderTop: i === 0 ? "none" : `1px solid ${t.border}`, textAlign: "left" }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "14px", color: t.text, fontWeight: "500" }}>{h.from}</span>
                  <span style={{ fontSize: "14px", color: t.subtext, margin: "0 6px" }}>–</span>
                  <span style={{ fontSize: "14px", color: t.text, fontWeight: "500" }}>{h.to}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: t.subtext, fontWeight: "500" }}>{abbr(h.from)} - {abbr(h.to)}</span>
                  <span style={{ color: "#1565c0", fontSize: "18px" }}>›</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

