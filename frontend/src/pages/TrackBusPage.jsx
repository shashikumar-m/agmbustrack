import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNotif } from "../NotificationContext";
import { NotificationBell } from "../NotificationUI";

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const busIcon = L.divIcon({
  html: `<div style="background:#1565c0;color:#fff;border-radius:50%;width:38px;height:38px;
    display:flex;align-items:center;justify-content:center;font-size:20px;
    box-shadow:0 3px 10px rgba(0,0,0,0.4);border:3px solid #fff;">🚌</div>`,
  iconSize: [38, 38], iconAnchor: [19, 19], className: "",
});

const stopDotIcon = (isPast, isCurrent) => L.divIcon({
  html: `<div style="background:${isCurrent ? "#1565c0" : isPast ? "#2e7d32" : "#fff"};
    border:3px solid ${isCurrent ? "#1565c0" : isPast ? "#2e7d32" : "#9e9e9e"};
    border-radius:50%;width:12px;height:12px;"></div>`,
  iconSize: [12, 12], iconAnchor: [6, 6], className: "",
});

import { API } from "../config.js";

// Auto-pan map to bus location
function MapPanner({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], map.getZoom());
  }, [lat, lng]);
  return null;
}

export default function TrackBusPage() {
  const navigate = useNavigate();
  const { busNumber } = useParams();
  const [bus, setBus] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("timeline");
  const routeFetchedFor = useRef(null);
  const notifiedStops = useRef(new Set());
  const prevStatus = useRef(null);
  const { notify } = useNotif();

  // ── Alarm state ──
  const [alarmStop, setAlarmStop] = useState(
    () => localStorage.getItem(`alarm_${busNumber}`) || ""
  );
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const alarmFired = useRef(false);

  useEffect(() => {
    fetchBus();
    const interval = setInterval(fetchBus, 5000);
    return () => clearInterval(interval);
  }, [busNumber]);

  const fetchBus = async () => {
    try {
      const res = await axios.get(`${API}/student/live-bus/${busNumber}`);
      const data = res.data;
      setBus(data);
      checkAlarm(data);

      // ── Notification triggers ──
      if (data && routeDetails) {
        const stops = routeDetails.stops || [];
        const currentIdx = stops.findIndex(s => s.name === data.currentStop);

        // Alert when bus is 2 stops away from last known stop in page URL
        // (we use the stop at currentIdx+2 as a proxy for "approaching")
        const twoAheadStop = stops[currentIdx + 2]?.name;
        if (twoAheadStop && !notifiedStops.current.has(data.currentStop)) {
          notifiedStops.current.add(data.currentStop);
          notify(
            `🚌 Bus approaching`,
            `${busNumber} is at ${data.currentStop} — 2 stops away from ${twoAheadStop}`,
            { icon: "🚌", color: "#1565c0", tag: `approach-${busNumber}` }
          );
        }

        // Alert on status change
        if (prevStatus.current && prevStatus.current !== data.busStatus) {
          const statusMsg = {
            delayed:   { title: "🟡 Bus Running Late", body: `${busNumber} is running behind schedule`, color: "#f57c00" },
            bus_full:  { title: "🔴 Bus is Full",       body: `${busNumber} is full — wait for next bus`, color: "#c62828" },
            breakdown: { title: "⚠️ Bus Breakdown",     body: `${busNumber} has a breakdown. Driver sent SOS.`, color: "#b71c1c" },
            on_time:   { title: "🟢 Bus Back on Track", body: `${busNumber} is now running on time`, color: "#2e7d32" },
          }[data.busStatus];
          if (statusMsg) {
            notify(statusMsg.title, statusMsg.body, { icon: statusMsg.title.split(" ")[0], color: statusMsg.color, tag: `status-${busNumber}` });
          }
        }
        prevStatus.current = data.busStatus;
      }

      if (data?.route && routeFetchedFor.current !== data.route) {
        routeFetchedFor.current = data.route;
        fetchRoute(data.route);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const fetchRoute = async (routeName) => {
    try {
      const res = await axios.get(`${API}/student/route-stops/${encodeURIComponent(routeName)}`);
      setRouteDetails(res.data);
    } catch { /* silent */ }
  };

  // ── Set / clear alarm for a stop ──
  const setAlarm = (stopName) => {
    setAlarmStop(stopName);
    alarmFired.current = false;
    localStorage.setItem(`alarm_${busNumber}`, stopName);
    setShowAlarmModal(false);
    notify(`🔔 Alarm set`, `You'll be alerted when bus reaches "${stopName}"`,
      { icon: "🔔", color: "#1565c0" });
  };
  const clearAlarm = () => {
    setAlarmStop("");
    alarmFired.current = false;
    localStorage.removeItem(`alarm_${busNumber}`);
  };

  // ── Check alarm in fetchBus ──
  const checkAlarm = (data) => {
    if (!alarmStop || alarmFired.current) return;
    if (data.currentStop === alarmStop || data.nextStop === alarmStop) {
      alarmFired.current = true;
      notify(`🔔 Your stop is near!`,
        `Bus ${busNumber} is ${data.currentStop === alarmStop ? "AT" : "approaching"} ${alarmStop}`,
        { icon: "🔔", color: "#e65100" });
    }
  };

  const mins = bus ? Math.floor((Date.now() - new Date(bus.lastUpdated)) / 60000) : null;
  const isLive = mins !== null && mins < 2;

  // Always-fresh Google Maps URL using latest bus GPS coords
  const googleMapsUrl = bus?.latitude && bus?.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${bus.latitude},${bus.longitude}`
    : null;

  // Google Maps directions TO the bus (navigate to bus location)
  const googleMapsNavUrl = bus?.latitude && bus?.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${bus.latitude},${bus.longitude}&travelmode=walking`
    : null;

  const stops = routeDetails?.stops || [];
  const currentIdx = bus ? stops.findIndex(s => s.name === bus.currentStop) : -1;
  const stopCoords = stops
    .filter(s => s.location?.coordinates?.length === 2)
    .map(s => [s.location.coordinates[1], s.location.coordinates[0]]);

  // Simulate arrival time: start from "now - (currentIdx * 8 min)" for demo
  const baseTime = bus ? new Date(bus.lastUpdated) : new Date();
  const getStopTime = (idx) => {
    const d = new Date(baseTime.getTime() - (currentIdx - idx) * 8 * 60000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const today = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{ background: "#1565c0", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: "10px" }}>
          <button onClick={() => navigate(-1)}
            style={{ background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer" }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: "15px", fontWeight: "700", letterSpacing: "0.2px" }}>
              {busNumber}
              {bus?.route && (
                <span style={{ fontWeight: "400", fontSize: "13px" }}>
                  {" "}– {bus.route}
                </span>
              )}
            </div>
          </div>
          <NotificationBell />
        </div>

        {/* Action pills */}
        <div style={{ display: "flex", gap: "8px", padding: "0 14px 12px", overflowX: "auto" }}>
          {/* Today — shows current date, tapping scrolls to current stop */}
          <ActionPill
            label={`📅 ${today}`}
            onClick={() => {
              // scroll current stop into view
              const el = document.getElementById("current-stop-row");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
          {/* Alarm — set notification for a specific stop */}
          <ActionPill
            label={alarmStop ? `🔔 ${alarmStop}` : "🔔 Set Alarm"}
            active={!!alarmStop}
            onClick={() => setShowAlarmModal(true)}
          />
          <ActionPill
            label="🗺️ Map"
            active={activeTab === "map"}
            onClick={() => setActiveTab(activeTab === "map" ? "timeline" : "map")}
          />
          {googleMapsNavUrl && (
            <ActionPill
              label="📍 Google Maps"
              onClick={() => window.open(googleMapsNavUrl, "_blank")}
            />
          )}
          <ActionPill
            label="↗ Share"
            onClick={() => {
              const url = window.location.href;
              if (navigator.share) {
                navigator.share({ title: `Bus ${busNumber} – Live Track`, url });
              } else {
                navigator.clipboard?.writeText(url);
                alert("Link copied!");
              }
            }}
          />
        </div>
      </div>

      {/* ── Alarm Modal ── */}
      {showAlarmModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center",
        }} onClick={e => { if (e.target === e.currentTarget) setShowAlarmModal(false); }}>
          <div style={{
            background: "#fff", borderRadius: "20px 20px 0 0",
            padding: "20px 20px 32px", width: "100%", maxWidth: "520px",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
          }}>
            <div style={{ width: "40px", height: "4px", background: "#e0e0e0", borderRadius: "2px", margin: "0 auto 16px" }} />
            <p style={{ fontWeight: "800", fontSize: "16px", marginBottom: "6px", color: "#1a1a2e" }}>
              🔔 Set Stop Alarm
            </p>
            <p style={{ fontSize: "13px", color: "#888", marginBottom: "16px" }}>
              Get notified when the bus is at or approaching your stop.
            </p>
            {alarmStop && (
              <div style={{ background: "#e8f5e9", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "#2e7d32", fontWeight: "700" }}>🔔 Alarm: {alarmStop}</span>
                <button onClick={() => { clearAlarm(); setShowAlarmModal(false); }}
                  style={{ background: "none", border: "none", color: "#c62828", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}>
                  Remove
                </button>
              </div>
            )}
            <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {stops.length === 0 ? (
                <p style={{ color: "#aaa", textAlign: "center", padding: "20px" }}>No stops loaded yet</p>
              ) : (
                stops.map((stop, idx) => (
                  <button key={stop._id || idx}
                    onClick={() => setAlarm(stop.name)}
                    style={{
                      padding: "12px 14px", border: "2px solid",
                      borderColor: alarmStop === stop.name ? "#1565c0" : "#e0e0e0",
                      borderRadius: "8px", background: alarmStop === stop.name ? "#e8f0fe" : "#fafafa",
                      cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: "10px",
                    }}>
                    <span style={{ fontWeight: "700", fontSize: "14px", color: "#1a1a2e" }}>{stop.name}</span>
                    {alarmStop === stop.name && <span style={{ marginLeft: "auto", color: "#1565c0", fontSize: "12px", fontWeight: "700" }}>✓ Active</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#888" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔄</div>
          <p>Loading bus data...</p>
        </div>
      ) : !bus ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#888" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🚌</div>
          <p style={{ fontWeight: "700", fontSize: "16px" }}>Bus not found or not active</p>
          <p style={{ fontSize: "13px", marginTop: "8px", color: "#aaa" }}>Ask the driver to start their trip</p>
        </div>
      ) : (
        <>
          {/* ── Map Tab (full screen below header) ── */}
          {activeTab === "map" && bus.latitude && bus.longitude && (
            <div style={{ flex: 1, minHeight: "calc(100vh - 120px)" }}>
              <MapContainer
                center={[bus.latitude, bus.longitude]}
                zoom={14}
                style={{ height: "calc(100vh - 120px)", width: "100%" }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                <MapPanner lat={bus.latitude} lng={bus.longitude} />
                {stopCoords.length > 1 && (
                  <Polyline positions={stopCoords} color="#1565c0" weight={4} opacity={0.75} dashArray="none" />
                )}
                {stops.map((stop, idx) => {
                  if (!stop.location?.coordinates?.length) return null;
                  const [lng, lat] = stop.location.coordinates;
                  const isPast = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <Marker key={stop._id} position={[lat, lng]} icon={stopDotIcon(isPast, isCurrent)}>
                      <Popup><strong>{stop.name}</strong>{isCurrent && <><br /><em>🚌 Bus is here</em></>}</Popup>
                    </Marker>
                  );
                })}
                <Marker position={[bus.latitude, bus.longitude]} icon={busIcon}>
                  <Popup>
                    <div style={{ minWidth: "160px" }}>
                      <strong style={{ fontSize: "14px" }}>🚌 {bus.busNumber}</strong><br />
                      <span style={{ fontSize: "12px" }}>Driver: {bus.driverName}</span><br />
                      <span style={{ fontSize: "12px" }}>Speed: {Math.round(bus.speed || 0)} km/h</span><br />
                      <span style={{ fontSize: "12px" }}>At: {bus.currentStop || "en route"}</span><br />
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {googleMapsUrl && (
                          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: "block", background: "#4285F4", color: "#fff", padding: "5px 10px", borderRadius: "6px", textDecoration: "none", fontSize: "12px", fontWeight: "700", textAlign: "center" }}>
                            📍 View in Google Maps
                          </a>
                        )}
                        {googleMapsNavUrl && (
                          <a href={googleMapsNavUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: "block", background: "#2e7d32", color: "#fff", padding: "5px 10px", borderRadius: "6px", textDecoration: "none", fontSize: "12px", fontWeight: "700", textAlign: "center" }}>
                            🧭 Get Directions
                          </a>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          )}

          {/* ── Timeline Tab ── */}
          {activeTab === "timeline" && (
            <div style={{ flex: 1, background: "#fff" }}>

              {/* Column headers — exactly like the train app */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "72px 1fr 72px",
                background: "#f5f7fa",
                borderBottom: "1px solid #e8e8e8",
                padding: "10px 14px",
              }}>
                <span style={colHeader}>Arrived</span>
                <span style={{ ...colHeader, textAlign: "center", fontWeight: "700", color: "#1565c0" }}>
                  {today}
                </span>
                <span style={{ ...colHeader, textAlign: "right" }}>Departed</span>
              </div>

              {/* Status bar */}
              <div style={{
                background: isLive ? "#e8f5e9" : "#fff8e1",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                borderBottom: "1px solid #e8e8e8",
                flexWrap: "wrap",
              }}>
                <span style={{
                  background: isLive ? "#2e7d32" : "#f57c00",
                  color: "#fff", padding: "3px 10px", borderRadius: "20px",
                  fontSize: "12px", fontWeight: "700",
                }}>
                  {isLive ? "● LIVE" : `Last seen ${mins}m ago`}
                </span>
                <span style={{ fontSize: "13px", color: "#555" }}>
                  Driver: <strong>{bus.driverName}</strong>
                  {bus.speed > 0 && <span style={{ marginLeft: "8px" }}>· {Math.round(bus.speed)} km/h</span>}
                </span>
                {/* Bus status from driver */}
                {bus.busStatus && bus.busStatus !== "on_time" && (
                  <span style={{
                    marginLeft: "auto",
                    background: bus.busStatus === "bus_full" ? "#ffebee" : bus.busStatus === "delayed" ? "#fff8e1" : "#ffebee",
                    color:      bus.busStatus === "bus_full" ? "#c62828" : bus.busStatus === "delayed" ? "#f57c00" : "#b71c1c",
                    padding: "3px 10px", borderRadius: "20px",
                    fontSize: "12px", fontWeight: "700",
                  }}>
                    {{ delayed: "🟡 Running Late", bus_full: "🔴 Bus Full", breakdown: "⚠️ Breakdown" }[bus.busStatus]}
                  </span>
                )}
                <span style={{ fontSize: "13px", color: "#aaa", marginLeft: "auto" }}>
                  Auto-refresh 5s
                </span>
              </div>

              {/* Stops timeline */}
              {stops.length === 0 ? (
                /* No route detail — show simple 2-stop version */
                <div style={{ padding: "20px" }}>
                  <SimpleTimeline bus={bus} />
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  {stops.map((stop, idx) => {
                    const isPast = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    const isFuture = idx > currentIdx;
                    const arrTime = idx === 0 ? "—" : getStopTime(idx);
                    const depTime = idx === stops.length - 1 ? "—" : getStopTime(idx);

                    return (
                      <StopRow
                        key={stop._id || idx}
                        stop={stop}
                        idx={idx}
                        total={stops.length}
                        isPast={isPast}
                        isCurrent={isCurrent}
                        isFuture={isFuture}
                        arrTime={arrTime}
                        depTime={depTime}
                      />
                    );
                  })}
                </div>
              )}

              {/* Bottom status bar */}
              <div style={{
                padding: "12px 16px",
                borderTop: "1px solid #e8e8e8",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#fafafa",
                gap: "10px",
              }}>
                <div style={{ flex: 1 }}>
                  {bus.currentStop ? (
                    <p style={{ fontSize: "13px", color: "#2e7d32", fontWeight: "700", margin: 0 }}>
                      🚌 Currently at {bus.currentStop}
                    </p>
                  ) : (
                    <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Location updating...</p>
                  )}
                  {bus.lastUpdated && (
                    <p style={{ fontSize: "11px", color: "#aaa", marginTop: "2px", margin: "2px 0 0" }}>
                      Updated {mins === 0 ? "just now" : `${mins} min ago`}
                    </p>
                  )}
                </div>

                {/* Google Maps button */}
                {googleMapsUrl && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      background: "#fff",
                      border: "1.5px solid #4285F4",
                      borderRadius: "8px",
                      padding: "7px 11px",
                      fontSize: "12px", fontWeight: "700",
                      color: "#4285F4",
                      textDecoration: "none",
                      flexShrink: 0,
                    }}>
                    <span style={{ fontSize: "14px" }}>
                      <span style={{ color: "#4285F4" }}>G</span>
                    </span>
                    Maps
                  </a>
                )}

                <button
                  onClick={fetchBus}
                  style={{
                    background: "#1565c0", color: "#fff",
                    border: "none", borderRadius: "50%",
                    width: "36px", height: "36px",
                    cursor: "pointer", fontSize: "16px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                  ↻
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Individual stop row — replicates the train timeline row ── */
function StopRow({ stop, idx, total, isPast, isCurrent, isFuture, arrTime, depTime }) {
  const dotColor = isPast ? "#2e7d32" : isCurrent ? "#1565c0" : "#bdbdbd";
  const lineColor = isPast ? "#2e7d32" : "#d0d8e8";
  const rowBg = isCurrent ? "#e8f0fe" : "transparent";

  return (
    <div
      id={isCurrent ? "current-stop-row" : undefined}
      style={{
      display: "grid",
      gridTemplateColumns: "72px 1fr 72px",
      background: rowBg,
      borderBottom: idx === total - 1 ? "none" : "1px solid #f0f0f0",
      minHeight: "80px",
      position: "relative",
    }}>
      {/* Arrived column */}
      <div style={{ padding: "14px 0 14px 14px", display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
        {idx > 0 && (
          <>
            <span style={{ fontSize: "13px", fontWeight: "600", color: isFuture ? "#888" : "#1a1a2e" }}>{arrTime}</span>
            {isPast && (
              <span style={{ fontSize: "11px", color: "#e53935", marginTop: "2px" }}>
                {/* delayed indicator could go here */}
              </span>
            )}
          </>
        )}
      </div>

      {/* Center column: spine + stop name */}
      <div style={{ display: "flex", gap: "12px", padding: "14px 8px" }}>
        {/* Spine */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "16px", flexShrink: 0 }}>
          {/* Top line */}
          {idx > 0 && (
            <div style={{ width: "4px", height: "14px", background: lineColor, borderRadius: "2px", marginBottom: "2px" }} />
          )}
          {/* Dot */}
          <div style={{
            width: isCurrent ? "16px" : "12px",
            height: isCurrent ? "16px" : "12px",
            borderRadius: "50%",
            background: dotColor,
            border: `3px solid ${dotColor}`,
            boxShadow: isCurrent ? `0 0 0 3px rgba(21,101,192,0.25)` : "none",
            flexShrink: 0,
            zIndex: 1,
            transition: "all 0.3s",
          }} />
          {/* Bottom line */}
          {idx < total - 1 && (
            <div style={{
              width: "4px",
              flex: 1,
              minHeight: "24px",
              background: isPast ? "#2e7d32" : "#d0d8e8",
              borderRadius: "2px",
              marginTop: "2px",
            }} />
          )}
        </div>

        {/* Stop name + details */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: isCurrent ? "15px" : "14px",
            fontWeight: isCurrent ? "700" : "500",
            color: isFuture ? "#888" : "#1a1a2e",
            lineHeight: "1.3",
          }}>
            {stop.name}
          </div>

          {/* Distance */}
          {stop.description && (
            <div style={{ fontSize: "12px", color: "#aaa", marginTop: "2px" }}>
              {stop.description}
            </div>
          )}

          {/* BUS HERE badge */}
          {isCurrent && (
            <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                background: "#1565c0", color: "#fff",
                padding: "3px 10px", borderRadius: "4px",
                fontSize: "11px", fontWeight: "700",
              }}>
                🚌 BUS IS HERE
              </span>
            </div>
          )}

          {/* Passed badge */}
          {isPast && (
            <div style={{ marginTop: "4px" }}>
              <span style={{ fontSize: "11px", color: "#2e7d32", fontWeight: "600" }}>✓ Passed</span>
            </div>
          )}
        </div>
      </div>

      {/* Departed column */}
      <div style={{ padding: "14px 14px 14px 0", display: "flex", flexDirection: "column", justifyContent: "flex-start", textAlign: "right" }}>
        {idx < total - 1 && (
          <span style={{ fontSize: "13px", fontWeight: "600", color: isFuture ? "#888" : "#1a1a2e" }}>{depTime}</span>
        )}
      </div>
    </div>
  );
}

/* Fallback when no route details in DB */
function SimpleTimeline({ bus }) {
  return (
    <div style={{ padding: "8px 0" }}>
      {[bus.currentStop, bus.nextStop].filter(Boolean).map((stop, i) => (
        <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "16px" }}>
            <div style={{
              width: i === 0 ? "16px" : "12px", height: i === 0 ? "16px" : "12px",
              borderRadius: "50%", background: i === 0 ? "#1565c0" : "#bdbdbd",
            }} />
            {i === 0 && <div style={{ width: "4px", height: "30px", background: "#e0e0e0", marginTop: "2px" }} />}
          </div>
          <div>
            <div style={{ fontWeight: i === 0 ? "700" : "500", fontSize: "14px", color: i === 0 ? "#1565c0" : "#888" }}>
              {i === 0 ? "🚌 " : ""}{stop}
            </div>
            <div style={{ fontSize: "12px", color: "#aaa" }}>{i === 0 ? "Bus is here" : "Next stop"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.18)",
        border: active ? "2px solid #fff" : "1px solid rgba(255,255,255,0.4)",
        borderRadius: "20px",
        padding: "5px 14px",
        color: "#fff",
        fontSize: "12px",
        fontWeight: "600",
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}>
      {label}
    </button>
  );
}

const colHeader = {
  fontSize: "12px",
  fontWeight: "600",
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

