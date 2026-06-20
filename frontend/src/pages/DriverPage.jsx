import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../ThemeContext";

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const busIcon = L.divIcon({
  html: `<div style="background:#e65100;color:#fff;border-radius:50%;width:38px;height:38px;
    display:flex;align-items:center;justify-content:center;font-size:20px;
    box-shadow:0 3px 10px rgba(0,0,0,0.4);border:3px solid #fff;">🚗</div>`,
  iconSize: [38, 38], iconAnchor: [19, 19], className: "",
});

function MapPanner({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.setView([lat, lng], 15); }, [lat, lng]);
  return null;
}

import { API } from "../config.js";

// Bus status options driver can broadcast
const STATUS_OPTIONS = [
  { value: "on_time",    label: "🟢 On Time",       color: "#2e7d32" },
  { value: "delayed",    label: "🟡 Running Late",   color: "#f57c00" },
  { value: "bus_full",   label: "🔴 Bus is Full",    color: "#c62828" },
  { value: "breakdown",  label: "⚠️ Breakdown",      color: "#b71c1c" },
];

export default function DriverPage() {
  const navigate = useNavigate();
  const { dark, toggle, t } = useTheme();

  // ── Driver login session ──
  // Stored in sessionStorage so it clears when tab is closed
  const [driverSession, setDriverSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("driverSession")) || null; }
    catch { return null; }
  });
  const [loginInput, setLoginInput]     = useState({ busNumber: "", driverName: "", password: "" });
  const [loginError, setLoginError]     = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPwd, setShowPwd]           = useState(false);

  const handleDriverLogin = async () => {
    const { busNumber: bn, driverName: dn, password } = loginInput;
    if (!password.trim())               { setLoginError("Enter your password"); return; }
    if (!bn.trim() && !dn.trim())       { setLoginError("Enter your Bus Number or Name"); return; }
    setLoginLoading(true); setLoginError("");
    try {
      const res = await axios.post(`${API}/driver/login`, {
        busNumber: bn.trim().toUpperCase(),
        driverName: dn.trim(),
        password: password.trim(),
      });
      if (res.data.success) {
        const session = res.data.driver;
        sessionStorage.setItem("driverSession", JSON.stringify(session));
        setDriverSession(session);
      } else {
        setLoginError(res.data.message || "Login failed");
      }
    } catch (err) {
      setLoginError(err.response?.data?.message || "Login failed. Check credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleDriverLogout = () => {
    stopTrip();
    sessionStorage.removeItem("driverSession");
    setDriverSession(null);
    setLoginInput({ busNumber: "", driverName: "", password: "" });
  };

  // Pre-fill from session
  const [driverName, setDriverName] = useState(driverSession?.driverName || "");
  const [busNumber, setBusNumber]   = useState(driverSession?.busNumber  || "");
  const [route, setRoute]           = useState(driverSession?.route      || "");

  // Keep routeRef in sync with session route
  useEffect(() => {
    if (driverSession?.route) routeRef.current = driverSession.route;
  }, [driverSession?.route]);

  const [tracking, setTracking]       = useState(false);
  const [watchId, setWatchId]         = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [error, setError]             = useState("");
  const [activeTab, setActiveTab]     = useState("status"); // status | map | stops

  // Live GPS data
  const [liveData, setLiveData] = useState({
    latitude: null, longitude: null,
    speed: 0, currentStop: "", nextStop: "",
  });

  // Driver manual controls
  const [busStatus, setBusStatus]       = useState("on_time");
  const [manualStop, setManualStop]     = useState("");
  const [routeStops, setRouteStops]     = useState([]);
  const [sosLoading, setSosLoading]     = useState(false);
  const [sosConfirm, setSosConfirm]     = useState(false);

  const [routes, setRoutes] = useState([]);
  const [buses, setBuses]   = useState([]);
  const [activeTrips, setActiveTrips] = useState([]); // buses already on a trip

  const routeRef    = useRef(route);
  const manualRef   = useRef(manualStop);
  const statusRef   = useRef(busStatus);
  useEffect(() => { routeRef.current  = route; },       [route]);
  useEffect(() => { manualRef.current = manualStop; },  [manualStop]);
  useEffect(() => { statusRef.current = busStatus; },   [busStatus]);

  useEffect(() => {
    axios.get(`${API}/admin/routes`).then(r => setRoutes(r.data)).catch(() => {});
    axios.get(`${API}/admin/buses`).then(r  => setBuses(r.data)).catch(() => {});
    fetchActiveTrips();
    // Refresh active trips every 10s so the list stays current
    const iv = setInterval(fetchActiveTrips, 10000);
    return () => clearInterval(iv);
  }, []);

  const fetchActiveTrips = async () => {
    try {
      const res = await axios.get(`${API}/driver/active-trips`);
      setActiveTrips(res.data);
    } catch { /* silent */ }
  };

  // Check if a bus is currently on an active trip by another driver
  const getTripInfo = (busNum) => activeTrips.find(t => t.busNumber === busNum);

  // Load route stops when route changes
  useEffect(() => {
    if (!route) { setRouteStops([]); return; }
    axios.get(`${API}/student/route-stops/${encodeURIComponent(route)}`)
      .then(r => setRouteStops(r.data?.stops || []))
      .catch(() => setRouteStops([]));
  }, [route]);

  const handleBusChange = (val) => {
    // Block selecting a bus that is already on an active trip
    if (val && getTripInfo(val)) return;
    setBusNumber(val);
    const found = buses.find(b => b.busNumber === val);
    if (found && !driverName) setDriverName(found.driverName);
    if (found && !route)      setRoute(found.route);
  };

  const startTrip = () => {
    if (!navigator.geolocation) { setError("GPS not supported on this device"); return; }
    if (!driverSession)         { setError("Not logged in — please log in first"); return; }

    // Always use session values — bus is locked to logged-in driver
    const bn = driverSession.busNumber;
    const dn = driverSession.driverName;
    const rt = driverSession.route;

    // Hard-block: refuse to start if bus is already active by someone else
    const existing = getTripInfo(bn);
    if (existing && existing.driverName !== dn) {
      setError(`🚫 Bus ${bn} is already on an active trip by ${existing.driverName}.`);
      return;
    }

    setError("");
    setTracking(true);
    setUpdateCount(0);

    // Store session values in refs so the watchPosition callback
    // always has the correct values (state closures don't update inside callbacks)
    routeRef.current  = rt;

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const speed = position.coords.speed
          ? Math.round(position.coords.speed * 3.6) : 0;

        try {
          const res = await axios.post(`${API}/driver/update-location`, {
            busNumber:  bn,                    // from session — always correct
            driverName: dn,                    // from session — always correct
            route:      routeRef.current,      // route ref (same as session route)
            latitude,
            longitude,
            speed,
            manualStop: manualRef.current,
            busStatus:  statusRef.current,
          });

          setLiveData({
            latitude, longitude, speed,
            currentStop: res.data.currentStop || "",
            nextStop:    res.data.nextStop    || "",
          });
          if (res.data.currentStop && !manualRef.current) {
            setManualStop("");
          }
          setUpdateCount(c => c + 1);
        } catch (err) {
          console.error(err);
        }
      },
      (err) => { setError("GPS error: " + err.message); setTracking(false); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    setWatchId(id);
  };

  const stopTrip = async () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    setTracking(false);
    setLiveData({ latitude: null, longitude: null, speed: 0, currentStop: "", nextStop: "" });
    setUpdateCount(0);
    setManualStop("");
    setBusStatus("on_time");
    // Tell backend this trip has ended — use session bus number (always correct)
    const bn = driverSession?.busNumber || busNumber;
    try {
      await axios.post(`${API}/driver/end-trip`, { busNumber: bn });
      fetchActiveTrips();
    } catch { /* silent */ }
  };

  const handleLogout = () => {
    handleDriverLogout();
    sessionStorage.removeItem("role");
    navigate("/");
  };

  const handleSOS = async () => {
    if (!sosConfirm) { setSosConfirm(true); return; }
    setSosLoading(true);
    try {
      await axios.post(`${API}/student/sos`, {
        busNumber,
        driverName,
        latitude:  liveData.latitude,
        longitude: liveData.longitude,
        message:   "Driver pressed SOS",
      });
      setBusStatus("breakdown");
      alert("🆘 SOS sent! Admin has been alerted with your location.");
    } catch { alert("SOS failed — please call admin directly."); }
    finally { setSosLoading(false); setSosConfirm(false); }
  };

  const currentStatusObj = STATUS_OPTIONS.find(s => s.value === busStatus) || STATUS_OPTIONS[0];

  // ── If not logged in, show login screen ──
  if (!driverSession) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #e65100 0%, #bf360c 100%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "sans-serif", padding: "20px",
      }}>
        {/* Back button */}
        <div style={{ position: "absolute", top: "14px", left: "14px" }}>
          <button onClick={() => { sessionStorage.removeItem("role"); navigate("/"); }}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer", borderRadius: "50%", width: "36px", height: "36px" }}>
            ←
          </button>
        </div>

        {/* Dark mode toggle */}
        <div style={{ position: "absolute", top: "14px", right: "14px" }}>
          <button onClick={toggle}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: "16px", cursor: "pointer", borderRadius: "20px", padding: "6px 12px" }}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Logo & title */}
        <div style={{ textAlign: "center", marginBottom: "32px", color: "#fff" }}>
          <div style={{ fontSize: "64px", lineHeight: 1, marginBottom: "10px" }}>🚗</div>
          <h1 style={{ fontSize: "24px", fontWeight: "800", margin: "0 0 6px" }}>Driver Login</h1>
          <p style={{ fontSize: "14px", opacity: 0.8, margin: 0 }}>Enter your credentials set by admin</p>
        </div>

        {/* Login card */}
        <div style={{
          background: t.card, borderRadius: "16px",
          padding: "28px 24px", width: "100%", maxWidth: "380px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
        }}>
          {loginError && (
            <div style={{ background: "#ffebee", color: "#c62828", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px", fontWeight: "600" }}>
              ⚠️ {loginError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Bus Number */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: t.subtext, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Bus Number
              </label>
              <input
                type="text"
                placeholder="e.g. KA25F1001"
                value={loginInput.busNumber}
                onChange={e => { setLoginInput(v => ({ ...v, busNumber: e.target.value })); setLoginError(""); }}
                onKeyDown={e => e.key === "Enter" && handleDriverLogin()}
                style={{
                  width: "100%", padding: "12px", border: `1.5px solid ${t.inputBorder}`,
                  borderRadius: "8px", fontSize: "15px", outline: "none",
                  background: t.input, color: t.text, boxSizing: "border-box",
                }}
              />
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ flex: 1, height: "1px", background: t.border }} />
              <span style={{ fontSize: "12px", color: t.subtext }}>OR</span>
              <div style={{ flex: 1, height: "1px", background: t.border }} />
            </div>

            {/* Driver Name */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: t.subtext, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Your Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Ravi Kumar"
                value={loginInput.driverName}
                onChange={e => { setLoginInput(v => ({ ...v, driverName: e.target.value })); setLoginError(""); }}
                onKeyDown={e => e.key === "Enter" && handleDriverLogin()}
                style={{
                  width: "100%", padding: "12px", border: `1.5px solid ${t.inputBorder}`,
                  borderRadius: "8px", fontSize: "15px", outline: "none",
                  background: t.input, color: t.text, boxSizing: "border-box",
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: t.subtext, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="Password set by admin"
                  value={loginInput.password}
                  onChange={e => { setLoginInput(v => ({ ...v, password: e.target.value })); setLoginError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleDriverLogin()}
                  autoFocus
                  style={{
                    width: "100%", padding: "12px 42px 12px 12px",
                    border: `1.5px solid ${t.inputBorder}`, borderRadius: "8px",
                    fontSize: "15px", outline: "none",
                    background: t.input, color: t.text, boxSizing: "border-box",
                  }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}>
                  {showPwd ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleDriverLogin}
            disabled={loginLoading}
            style={{
              width: "100%", marginTop: "20px", padding: "15px",
              background: loginLoading ? "#bdbdbd" : "#e65100",
              color: "#fff", border: "none", borderRadius: "10px",
              fontSize: "16px", fontWeight: "700",
              cursor: loginLoading ? "not-allowed" : "pointer",
            }}>
            {loginLoading ? "⏳ Logging in..." : "🚗 Login & Continue"}
          </button>

          <p style={{ textAlign: "center", color: t.subtext, fontSize: "12px", marginTop: "14px" }}>
            Contact admin if you don't have credentials
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "sans-serif", transition: "background 0.3s" }}>

      {/* ── Header ── */}
      <div style={{
        background: tracking ? "#2e7d32" : "#e65100",
        padding: "13px 16px",
        display: "flex", alignItems: "center", gap: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        transition: "background 0.4s",
      }}>
        <button onClick={handleLogout}
          style={{ background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer" }}>
          ←
        </button>
        <span style={{ color: "#fff", fontSize: "17px", fontWeight: "700", flex: 1 }}>
          🚗 Driver Dashboard
        </span>
        <button onClick={toggle} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontSize: "14px" }}>
          {dark ? "☀️" : "🌙"}
        </button>
        {tracking && (
          <span style={{
            background: "rgba(255,255,255,0.22)", color: "#fff",
            padding: "4px 12px", borderRadius: "20px",
            fontSize: "12px", fontWeight: "700",
          }}>● LIVE · {updateCount}</span>
        )}
      </div>

      <div style={{ padding: "14px", maxWidth: "520px", margin: "0 auto" }}>

        {/* ── Trip Setup (hidden when tracking) ── */}
        {!tracking && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <SectionLabel text="Trip Setup" />
              <span style={{ fontSize: "11px", color: "#aaa" }}>
                🔄 Updates every 10s
              </span>
            </div>

            {error && <ErrorBox msg={error} />}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Bus is locked to login session — show as read-only */}
              <div style={{
                background: "#e8f0fe", border: "2px solid #1565c0",
                borderRadius: "10px", padding: "12px 14px",
              }}>
                <div style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.5px", marginBottom: "6px" }}>
                  🔒 Your Assigned Bus (from login)
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#888" }}>BUS</div>
                    <div style={{ fontWeight: "800", fontSize: "16px", color: "#1565c0" }}>{driverSession.busNumber}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#888" }}>DRIVER</div>
                    <div style={{ fontWeight: "700", fontSize: "14px", color: "#333" }}>{driverSession.driverName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#888" }}>ROUTE</div>
                    <div style={{ fontWeight: "600", fontSize: "13px", color: "#555" }}>{driverSession.route}</div>
                  </div>
                </div>
              </div>

              {/* Show active trips for awareness */}
              {activeTrips.filter(t => t.busNumber !== driverSession.busNumber).length > 0 && (
                <div>
                  <Label text="Other Buses On Active Trips" />
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "4px" }}>
                    {activeTrips
                      .filter(t => t.busNumber !== driverSession.busNumber)
                      .map(trip => (
                        <div key={trip.busNumber} style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "7px 10px", background: "#fff3e0",
                          border: "1px solid #ef9a9a", borderRadius: "8px",
                        }}>
                          <span style={{ background: "#c62828", color: "#fff", padding: "2px 7px", borderRadius: "5px", fontWeight: "700", fontSize: "12px" }}>
                            🔴 {trip.busNumber}
                          </span>
                          <div style={{ flex: 1, fontSize: "12px", color: "#555" }}>
                            {trip.driverName} · {trip.route}
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={startTrip}
              disabled={buses.filter(b => !getTripInfo(b.busNumber)).length === 0}
              style={{
                width: "100%", marginTop: "16px", padding: "14px",
                background: buses.filter(b => !getTripInfo(b.busNumber)).length === 0 ? "#bdbdbd" : "#2e7d32",
                color: "#fff", border: "none",
                borderRadius: "8px", fontSize: "15px", fontWeight: "700",
                cursor: buses.filter(b => !getTripInfo(b.busNumber)).length === 0 ? "not-allowed" : "pointer",
              }}>
              ▶ Start Trip
            </button>
          </div>
        )}

        {/* ── Active Trip Panel ── */}
        {tracking && (
          <>
            {/* Trip summary strip */}
            <div style={{
              background: "#fff", borderRadius: "10px",
              padding: "12px 14px", marginBottom: "12px",
              boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
              display: "flex", alignItems: "center", gap: "12px",
            }}>
              <div style={{
                background: "#e65100", color: "#fff",
                padding: "4px 10px", borderRadius: "6px",
                fontWeight: "700", fontSize: "13px",
              }}>{busNumber}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a1a2e" }}>{driverName}</div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "1px" }}>{route}</div>
              </div>
              <button onClick={stopTrip} style={{
                background: "#ffebee", color: "#c62828",
                border: "none", borderRadius: "8px",
                padding: "7px 14px", fontWeight: "700",
                fontSize: "13px", cursor: "pointer",
              }}>■ End</button>
            </div>

            {/* Tabs */}
            <div style={{
              display: "flex", background: "#fff",
              borderRadius: "10px", padding: "4px",
              boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
              marginBottom: "12px", gap: "4px",
            }}>
              {[["status","📊 Status"], ["map","🗺️ Map"], ["stops","🚏 Stops"]].map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  style={{
                    flex: 1, padding: "9px 6px", border: "none",
                    borderRadius: "8px", fontWeight: "600", fontSize: "13px",
                    cursor: "pointer",
                    background: activeTab === key ? "#e65100" : "transparent",
                    color:      activeTab === key ? "#fff"    : "#666",
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── STATUS TAB ── */}
            {activeTab === "status" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

                {/* GPS live stats */}
                <div style={card}>
                  <SectionLabel text="Live GPS" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <InfoBox label="Speed"  value={liveData.speed ? `${liveData.speed} km/h` : "0 km/h"} />
                    <InfoBox label="Updates" value={updateCount} />
                    <InfoBox label="Latitude"  value={liveData.latitude  ? liveData.latitude.toFixed(5)  : "—"} />
                    <InfoBox label="Longitude" value={liveData.longitude ? liveData.longitude.toFixed(5) : "—"} />
                  </div>
                </div>

                {/* Auto-detected stop */}
                <div style={card}>
                  <SectionLabel text="Current Position (Auto)" />
                  <div style={{
                    background: "#e8f0fe", borderRadius: "8px",
                    padding: "12px 14px", display: "flex", gap: "20px",
                  }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "#888" }}>AT STOP</div>
                      <div style={{ fontWeight: "700", color: "#1565c0", fontSize: "15px", marginTop: "3px" }}>
                        🚌 {liveData.currentStop || "Detecting..."}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#888" }}>NEXT</div>
                      <div style={{ fontWeight: "700", color: "#555", fontSize: "15px", marginTop: "3px" }}>
                        → {liveData.nextStop || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bus Status broadcast */}
                <div style={card}>
                  <SectionLabel text="Broadcast Status to Students" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {STATUS_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setBusStatus(opt.value)}
                        style={{
                          padding: "11px 8px", border: "2px solid",
                          borderColor: busStatus === opt.value ? opt.color : "#e0e0e0",
                          borderRadius: "8px", background: busStatus === opt.value ? opt.color + "18" : "#fafafa",
                          fontWeight: busStatus === opt.value ? "700" : "500",
                          fontSize: "13px", cursor: "pointer",
                          color: busStatus === opt.value ? opt.color : "#555",
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div style={{
                    marginTop: "10px", padding: "10px 12px",
                    background: currentStatusObj.color + "18",
                    borderRadius: "8px", borderLeft: `4px solid ${currentStatusObj.color}`,
                    fontSize: "13px", fontWeight: "600", color: currentStatusObj.color,
                  }}>
                    Broadcasting: {currentStatusObj.label}
                  </div>
                </div>

                {/* SOS Button */}
                <div style={card}>
                  <SectionLabel text="Emergency SOS" />
                  <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
                    Press SOS to alert admin with your live location immediately.
                  </p>
                  {!sosConfirm ? (
                    <button onClick={handleSOS} style={{
                      width: "100%", padding: "14px",
                      background: "#b71c1c", color: "#fff",
                      border: "none", borderRadius: "8px",
                      fontSize: "15px", fontWeight: "800",
                      cursor: "pointer", letterSpacing: "1px",
                    }}>
                      🆘 SEND SOS
                    </button>
                  ) : (
                    <div>
                      <p style={{ fontSize: "13px", color: "#b71c1c", fontWeight: "700", marginBottom: "10px", textAlign: "center" }}>
                        ⚠️ Confirm SOS? This will alert admin.
                      </p>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={() => setSosConfirm(false)} style={{ flex: 1, padding: "11px", background: "#eee", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                        <button onClick={handleSOS} disabled={sosLoading} style={{ flex: 2, padding: "11px", background: "#b71c1c", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}>
                          {sosLoading ? "Sending..." : "✅ Confirm SOS"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── MAP TAB ── */}
            {activeTab === "map" && (
              <div style={{ borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.12)" }}>
                {liveData.latitude ? (
                  <MapContainer
                    center={[liveData.latitude, liveData.longitude]}
                    zoom={15}
                    style={{ height: "420px", width: "100%" }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap"
                    />
                    <MapPanner lat={liveData.latitude} lng={liveData.longitude} />
                    <Marker position={[liveData.latitude, liveData.longitude]} icon={busIcon}>
                      <Popup>
                        <strong>🚗 {busNumber}</strong><br />
                        {driverName}<br />
                        Speed: {liveData.speed} km/h<br />
                        At: {liveData.currentStop || "en route"}
                      </Popup>
                    </Marker>
                  </MapContainer>
                ) : (
                  <div style={{
                    height: "200px", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    background: "#f0f4f8", borderRadius: "12px",
                    color: "#aaa", fontSize: "14px",
                  }}>
                    📍 Waiting for GPS signal...
                  </div>
                )}
              </div>
            )}

            {/* ── STOPS TAB ── */}
            {activeTab === "stops" && (
              <div style={card}>
                <SectionLabel text="Mark Current Stop Manually" />
                <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>
                  GPS auto-detects your stop. Use this only if it's wrong.
                </p>

                {routeStops.length === 0 ? (
                  <p style={{ color: "#aaa", fontSize: "13px", textAlign: "center", padding: "20px" }}>
                    No stops found for this route
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {routeStops.map((stop, idx) => {
                      const isAuto    = liveData.currentStop === stop.name && !manualStop;
                      const isManual  = manualStop === stop.name;
                      const isActive  = isAuto || isManual;

                      return (
                        <button key={stop._id || idx}
                          onClick={() => setManualStop(isManual ? "" : stop.name)}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "11px 12px", border: "2px solid",
                            borderColor: isActive ? "#1565c0" : "#e0e0e0",
                            borderRadius: "8px", background: isActive ? "#e8f0fe" : "#fafafa",
                            cursor: "pointer", textAlign: "left",
                          }}>
                          <div style={{
                            width: "26px", height: "26px", borderRadius: "50%",
                            background: isActive ? "#1565c0" : "#e0e0e0",
                            color: "#fff", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: "700", flexShrink: 0,
                          }}>{idx + 1}</div>
                          <span style={{
                            fontSize: "14px", fontWeight: isActive ? "700" : "500",
                            color: isActive ? "#1565c0" : "#444", flex: 1,
                          }}>
                            {stop.name}
                          </span>
                          {isAuto   && <span style={{ fontSize: "11px", color: "#2e7d32", fontWeight: "600" }}>GPS ✓</span>}
                          {isManual && <span style={{ fontSize: "11px", color: "#e65100", fontWeight: "600" }}>MANUAL ✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {manualStop && (
                  <button onClick={() => setManualStop("")}
                    style={{
                      width: "100%", marginTop: "10px", padding: "10px",
                      background: "#fff3e0", color: "#e65100",
                      border: "1px solid #e65100", borderRadius: "8px",
                      fontSize: "13px", fontWeight: "600", cursor: "pointer",
                    }}>
                    ✕ Clear Manual Override — Resume GPS
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {!tracking && (
          <p style={{ textAlign: "center", color: "#aaa", fontSize: "13px", marginTop: "12px" }}>
            Your live GPS will be shared with students once you start the trip
          </p>
        )}
      </div>
    </div>
  );
}

// ── Small helpers ──
const card = {
  background: "#fff", borderRadius: "12px",
  padding: "16px", marginBottom: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

function SectionLabel({ text }) {
  return (
    <p style={{
      fontSize: "11px", fontWeight: "700", color: "#888",
      textTransform: "uppercase", letterSpacing: "0.7px",
      margin: "0 0 12px",
    }}>{text}</p>
  );
}

function Label({ text }) {
  return (
    <label style={{
      display: "block", fontSize: "12px", fontWeight: "600",
      color: "#666", marginBottom: "5px",
      textTransform: "uppercase", letterSpacing: "0.4px",
    }}>{text}</label>
  );
}

function InfoBox({ label, value }) {
  return (
    <div style={{ background: "#f5f7fa", borderRadius: "8px", padding: "10px 12px" }}>
      <div style={{ fontSize: "10px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontWeight: "700", color: "#1a1a2e", fontSize: "13px", marginTop: "3px", wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{
      background: "#ffebee", color: "#c62828",
      padding: "10px 12px", borderRadius: "8px",
      fontSize: "13px", marginBottom: "12px",
    }}>⚠️ {msg}</div>
  );
}

const inp = (disabled) => ({
  width: "100%", padding: "11px 10px",
  border: "1px solid #e0e0e0", borderRadius: "8px",
  fontSize: "14px", outline: "none",
  background: disabled ? "#f5f5f5" : "#fff",
  color: "#333", boxSizing: "border-box",
});

