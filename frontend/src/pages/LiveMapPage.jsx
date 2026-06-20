import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import { useTheme } from "../ThemeContext";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

import { API } from "../config.js";

const STATUS_COLOR = { on_time: "#2e7d32", delayed: "#f57c00", bus_full: "#c62828", breakdown: "#b71c1c" };
const STATUS_LABEL = { on_time: "On Time", delayed: "Late", bus_full: "Full", breakdown: "⚠️ SOS" };

function makeBusIcon(busNumber, status) {
  const color = STATUS_COLOR[status] || "#1565c0";
  return L.divIcon({
    html: `<div style="background:${color};color:#fff;border-radius:8px;padding:4px 7px;
      font-size:11px;font-weight:700;white-space:nowrap;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid #fff;line-height:1.3;text-align:center;">
      🚌<br/>${busNumber}
    </div>`,
    iconSize: [64, 36], iconAnchor: [32, 18], className: "",
  });
}

function FitBounds({ buses }) {
  const map = useMap();
  useEffect(() => {
    const pts = buses.filter(b => b.latitude && b.longitude).map(b => [b.latitude, b.longitude]);
    if (pts.length > 0) {
      try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); } catch {}
    }
  }, [buses.length]);
  return null;
}

export default function LiveMapPage() {
  const { t, dark } = useTheme();
  const [buses, setBuses]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    fetchBuses();
    const iv = setInterval(fetchBuses, 8000);
    return () => clearInterval(iv);
  }, []);

  const fetchBuses = async () => {
    try {
      const res = await axios.get(`${API}/student/live-buses`);
      setBuses(res.data);
      setLastUpdate(new Date());
    } catch {}
  };

  const activeBuses = buses.filter(b => {
    const mins = Math.floor((Date.now() - new Date(b.lastUpdated)) / 60000);
    return mins < 30; // hide buses not seen in 30 min
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Stats strip */}
      <div style={{
        background: t.card, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: "16px",
        borderBottom: `1px solid ${t.border}`,
        flexWrap: "wrap",
      }}>
        <div>
          <span style={{ fontSize: "11px", color: t.subtext, textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Buses</span>
          <div style={{ fontWeight: "700", fontSize: "20px", color: t.text }}>{activeBuses.length}</div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: t.subtext, textTransform: "uppercase", letterSpacing: "0.5px" }}>Live</span>
          <div style={{ fontWeight: "700", fontSize: "20px", color: "#2e7d32" }}>
            {activeBuses.filter(b => Math.floor((Date.now() - new Date(b.lastUpdated)) / 60000) < 2).length}
          </div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: t.subtext, textTransform: "uppercase", letterSpacing: "0.5px" }}>SOS</span>
          <div style={{ fontWeight: "700", fontSize: "20px", color: "#b71c1c" }}>
            {activeBuses.filter(b => b.busStatus === "breakdown").length}
          </div>
        </div>
        {lastUpdate && (
          <span style={{ fontSize: "11px", color: t.subtext, marginLeft: "auto" }}>
            Updated {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>

      {/* Map */}
      <div style={{ flex: 1, minHeight: "400px", position: "relative" }}>
        {activeBuses.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", color: t.subtext, flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "48px" }}>🚌</div>
            <p style={{ fontWeight: "600" }}>No active buses right now</p>
            <p style={{ fontSize: "13px" }}>Buses appear here when drivers start their trip</p>
          </div>
        ) : (
          <MapContainer center={[15.3647, 75.1240]} zoom={13} style={{ height: "500px", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            <FitBounds buses={activeBuses} />
            {activeBuses.map(bus => {
              if (!bus.latitude || !bus.longitude) return null;
              const mins = Math.floor((Date.now() - new Date(bus.lastUpdated)) / 60000);
              return (
                <Marker key={bus._id || bus.busNumber}
                  position={[bus.latitude, bus.longitude]}
                  icon={makeBusIcon(bus.busNumber, bus.busStatus)}
                  eventHandlers={{ click: () => setSelected(bus) }}>
                  <Popup>
                    <div style={{ minWidth: "160px" }}>
                      <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "6px" }}>🚌 {bus.busNumber}</div>
                      <div style={{ fontSize: "12px", lineHeight: "1.8" }}>
                        <b>Driver:</b> {bus.driverName}<br />
                        <b>Route:</b> {bus.route}<br />
                        <b>At:</b> {bus.currentStop || "en route"}<br />
                        <b>Next:</b> {bus.nextStop || "—"}<br />
                        <b>Speed:</b> {Math.round(bus.speed || 0)} km/h<br />
                        <b>Status:</b> <span style={{ color: STATUS_COLOR[bus.busStatus] || "#2e7d32", fontWeight: "700" }}>{STATUS_LABEL[bus.busStatus] || "On Time"}</span><br />
                        <b>Updated:</b> {mins < 1 ? "just now" : `${mins}m ago`}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* Bus list below map */}
      <div style={{ background: t.card, borderTop: `1px solid ${t.border}`, maxHeight: "220px", overflowY: "auto" }}>
        {activeBuses.map(bus => {
          const mins = Math.floor((Date.now() - new Date(bus.lastUpdated)) / 60000);
          const isLive = mins < 2;
          const isSOS  = bus.busStatus === "breakdown";
          return (
            <div key={bus._id || bus.busNumber}
              onClick={() => setSelected(bus)}
              style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${t.border}`,
                display: "flex", alignItems: "center", gap: "10px",
                cursor: "pointer",
                background: isSOS ? "#ffebee" : selected?._id === bus._id ? t.pill : t.card,
              }}>
              <div style={{ background: STATUS_COLOR[bus.busStatus] || "#1565c0", color: "#fff", padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "700", flexShrink: 0 }}>
                {bus.busNumber}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: isSOS ? "#b71c1c" : t.text }}>
                  {isSOS ? "🆘 " : ""}{bus.driverName}
                </div>
                <div style={{ fontSize: "11px", color: t.subtext }}>{bus.currentStop || "en route"} → {bus.nextStop || "—"}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: isLive ? "#2e7d32" : t.orange }}>
                  {isLive ? "● LIVE" : `${mins}m ago`}
                </div>
                <div style={{ fontSize: "11px", color: t.subtext }}>{Math.round(bus.speed || 0)} km/h</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

