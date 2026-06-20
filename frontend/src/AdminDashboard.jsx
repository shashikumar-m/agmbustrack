import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from './ThemeContext';
import LiveMapPage from './pages/LiveMapPage';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

import { API as _API } from './config.js';
const API_URL = _API + '/admin';

// Click-on-map handler
function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { dark, toggle, t } = useTheme();
  const [activeTab, setActiveTab] = useState('livemap');

  // ── Stops ──
  const [stops, setStops]     = useState([]);
  const [newStop, setNewStop] = useState({ name: '', latitude: '', longitude: '', description: '' });
  const [locLoading, setLocLoading] = useState(false);
  const [mapCenter, setMapCenter]   = useState([15.3647, 75.1240]);
  const [pickedCoords, setPickedCoords] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // ── Stop name autocomplete (Nominatim OSM) ──
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [nameLoading, setNameLoading]         = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameDebounce = useRef(null);

  const fetchPlaceSuggestions = useCallback((query) => {
    clearTimeout(nameDebounce.current);
    if (!query || query.length < 2) { setNameSuggestions([]); setShowSuggestions(false); return; }

    nameDebounce.current = setTimeout(async () => {
      setNameLoading(true);
      try {
        // Run two searches in parallel:
        // 1. Direct query with India filter
        // 2. Query + "Hubballi" to catch local area names like "Vidyanagar, Hubli"
        const base = 'https://nominatim.openstreetmap.org/search';
        const headers = { 'Accept-Language': 'en', 'User-Agent': 'CollegeBusApp/1.0' };
        const params = `&format=json&limit=8&countrycodes=in&addressdetails=1&namedetails=1&extratags=1`;

        const [r1, r2, r3] = await Promise.all([
          // Search as-is
          fetch(`${base}?q=${encodeURIComponent(query)}${params}`, { headers }).then(r => r.json()).catch(() => []),
          // Search with Hubballi appended
          fetch(`${base}?q=${encodeURIComponent(query + ' Hubballi')}${params}`, { headers }).then(r => r.json()).catch(() => []),
          // Search with Dharwad district appended (covers Hubli-Dharwad twin city)
          fetch(`${base}?q=${encodeURIComponent(query + ' Dharwad Karnataka')}${params}`, { headers }).then(r => r.json()).catch(() => []),
        ]);

        // Merge, deduplicate by place_id, prefer local results
        const seen = new Set();
        const merged = [...r1, ...r2, ...r3].filter(p => {
          if (seen.has(p.place_id)) return false;
          seen.add(p.place_id);
          return true;
        });

        // Sort: Karnataka results first, then rest of India
        merged.sort((a, b) => {
          const aKA = (a.display_name || '').toLowerCase().includes('karnataka') ? 0 : 1;
          const bKA = (b.display_name || '').toLowerCase().includes('karnataka') ? 0 : 1;
          const aHubli = (a.display_name || '').toLowerCase().includes('hubballi') ||
                         (a.display_name || '').toLowerCase().includes('hubli') ? 0 : 1;
          const bHubli = (b.display_name || '').toLowerCase().includes('hubballi') ||
                         (b.display_name || '').toLowerCase().includes('hubli') ? 0 : 1;
          return (aHubli - bHubli) || (aKA - bKA);
        });

        const top = merged.slice(0, 10);
        setNameSuggestions(top);
        setShowSuggestions(top.length > 0);
      } catch {
        setNameSuggestions([]);
      } finally {
        setNameLoading(false);
      }
    }, 350);
  }, []);

  const handleSelectSuggestion = (place) => {
    // Build the cleanest possible stop name
    const displayName =
      place.namedetails?.name
      || place.address?.neighbourhood
      || place.address?.suburb
      || place.address?.quarter
      || place.address?.road
      || place.display_name.split(',')[0].trim();

    // Build a useful description: area + city
    const city    = place.address?.city || place.address?.town || place.address?.village || '';
    const district= place.address?.county || '';
    const desc    = [city, district].filter(Boolean).join(', ');

    setNewStop(s => ({
      ...s,
      name:        displayName,
      latitude:    parseFloat(place.lat).toFixed(7),
      longitude:   parseFloat(place.lon).toFixed(7),
      description: s.description || desc,
    }));
    setMapCenter([parseFloat(place.lat), parseFloat(place.lon)]);
    setPickedCoords({ lat: parseFloat(place.lat), lng: parseFloat(place.lon) });
    setShowSuggestions(false);
    setNameSuggestions([]);
    setShowMapPicker(true); // open map so admin can verify location
  };

  // ── Routes ──
  const [routes, setRoutes]       = useState([]);
  const [newRoute, setNewRoute]   = useState({ routeName: '', selectedStopIds: [] });

  // ── Buses ──
  const [buses, setBuses]   = useState([]);
  const [newBus, setNewBus] = useState({ busNumber: '', collegeNumber: '', driverName: '', driverPassword: '', route: '', capacity: 50, showPwd: false });

  useEffect(() => { fetchStops(); fetchRoutes(); fetchBuses(); }, []);

  const fetchStops   = async () => { try { const r = await axios.get(`${API_URL}/stops`);  setStops(r.data);  } catch {} };
  const fetchRoutes  = async () => { try { const r = await axios.get(`${API_URL}/routes`); setRoutes(r.data); } catch {} };
  const fetchBuses   = async () => { try { const r = await axios.get(`${API_URL}/buses`);  setBuses(r.data);  } catch {} };

  // ── Use My Location ──
  const useMyLocation = () => {
    if (!navigator.geolocation) { alert('GPS not supported'); return; }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(7);
        const lng = pos.coords.longitude.toFixed(7);
        setNewStop(s => ({ ...s, latitude: lat, longitude: lng }));
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        setPickedCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setShowMapPicker(true);
        setLocLoading(false);
      },
      (err) => { alert('GPS error: ' + err.message); setLocLoading(false); },
      { enableHighAccuracy: true }
    );
  };

  // ── Map click ──
  const handleMapPick = useCallback((lat, lng) => {
    setPickedCoords({ lat, lng });
    setNewStop(s => ({
      ...s,
      latitude:  lat.toFixed(7),
      longitude: lng.toFixed(7),
    }));
  }, []);

  // ── Create / Delete Stops ──
  const handleCreateStop = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/stops`, newStop);
      setNewStop({ name: '', latitude: '', longitude: '', description: '' });
      setPickedCoords(null);
      setShowMapPicker(false);
      setNameSuggestions([]);
      setShowSuggestions(false);
      fetchStops();
    } catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
  };
  const handleDeleteStop = async (id) => {
    if (!window.confirm('Delete this stop?')) return;
    try { await axios.delete(`${API_URL}/stops/${id}`); fetchStops(); } catch { alert('Delete failed'); }
  };

  // ── Create / Delete Routes ──
  const handleCreateRoute = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/routes`, { routeName: newRoute.routeName, stopIds: newRoute.selectedStopIds });
      setNewRoute({ routeName: '', selectedStopIds: [] });
      fetchRoutes();
    } catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
  };
  const handleDeleteRoute = async (id) => {
    if (!window.confirm('Delete this route?')) return;
    try { await axios.delete(`${API_URL}/routes/${id}`); fetchRoutes(); } catch { alert('Delete failed'); }
  };

  // ── Create / Delete Buses ──
  const handleCreateBus = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/buses`, newBus);
      setNewBus({ busNumber: '', collegeNumber: '', driverName: '', driverPassword: '', route: '', capacity: 50, showPwd: false });
      fetchBuses();
    } catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
  };
  const handleDeleteBus = async (id) => {
    if (!window.confirm('Delete this bus?')) return;
    try { await axios.delete(`${API_URL}/buses/${id}`); fetchBuses(); } catch { alert('Delete failed'); }
  };

  const toggleStopInRoute = (id) => {
    setNewRoute(p => ({
      ...p,
      selectedStopIds: p.selectedStopIds.includes(id)
        ? p.selectedStopIds.filter(x => x !== id)
        : [...p.selectedStopIds, id],
    }));
  };

  const tabs = [
    { key: 'livemap', label: '🗺️ Live Map', count: null  },
    { key: 'stops',   label: '🚏 Stops',    count: stops.length  },
    { key: 'routes',  label: '🛣️ Routes',   count: routes.length },
    { key: 'buses',   label: '🚌 Buses',    count: buses.length  },
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'sans-serif', transition: 'background 0.3s' }}>
      <style>{`
        .admin-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) { .admin-2col { grid-template-columns: 1fr; } }
        .bus-num-grid-admin { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
        @media (max-width: 360px) { .bus-num-grid-admin { grid-template-columns: repeat(4, 1fr); } }
      `}</style>

      {/* Header */}
      <div style={{ background: '#6a1b9a', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <button onClick={() => { sessionStorage.removeItem("role"); navigate('/'); }}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer' }}>←</button>
        <h1 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0, flex: 1 }}>🛠️ Admin Dashboard</h1>
        <button onClick={toggle} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '14px' }}>
          {dark ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Tabs */}
      <div className="admin-tabs-bar" style={{ background: t.card, borderBottom: `1px solid ${t.border}`, display: 'flex', padding: '0 8px' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '13px 14px', border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid #6a1b9a' : '3px solid transparent',
              background: 'none', fontWeight: activeTab === tab.key ? '700' : '500',
              color: activeTab === tab.key ? '#6a1b9a' : t.subtext,
              cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap',
            }}>
            {tab.label}
            {tab.count !== null && (
              <span style={{ marginLeft: '5px', background: activeTab === tab.key ? '#6a1b9a' : t.pill, color: activeTab === tab.key ? '#fff' : t.subtext, padding: '1px 6px', borderRadius: '10px', fontSize: '11px' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ LIVE MAP TAB ═══ */}
      {activeTab === 'livemap' && <LiveMapPage />}

      <div style={{ padding: '12px 10px', maxWidth: '100%', margin: '0 auto' }}>

        {/* ═══════════ STOPS TAB ═══════════ */}
        {activeTab === 'stops' && (
          <div className='admin-2col'>

            {/* Add stop form */}
            <div style={card}>
              <p style={cardHead}>Add New Stop</p>

              <div style={{
                background: '#f3e5f5', border: '1px solid #ce93d8',
                borderRadius: '8px', padding: '10px 12px',
                fontSize: '12px', color: '#6a1b9a', marginBottom: '12px', lineHeight: '1.6',
              }}>
                <strong>✨ Smart Stop Entry:</strong><br />
                Type the stop name → pick from the dropdown → lat/lng fills automatically.<br />
                Then confirm or fine-tune location using the map picker below.
              </div>

              <form onSubmit={handleCreateStop} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* ── Stop Name with Autocomplete ── */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: t.subtext, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Stop Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Type stop name (e.g. Navanagar, AGM College...)"
                      value={newStop.name}
                      required
                      autoComplete="off"
                      onChange={e => {
                        const v = e.target.value;
                        setNewStop(s => ({ ...s, name: v }));
                        fetchPlaceSuggestions(v);
                      }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onFocus={() => nameSuggestions.length > 0 && setShowSuggestions(true)}
                      style={{
                        width: '100%', padding: '10px 36px 10px 10px',
                        border: `1.5px solid ${showSuggestions ? '#6a1b9a' : t.inputBorder}`,
                        borderRadius: '8px', fontSize: '14px',
                        outline: 'none', background: t.input, color: t.text,
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                      }}
                    />
                    {/* Spinner / check */}
                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px' }}>
                      {nameLoading ? '⏳' : newStop.latitude ? '✅' : '🔍'}
                    </div>
                  </div>

                  {showSuggestions && nameSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0,
                      background: t.card, border: `1.5px solid #6a1b9a`,
                      borderTop: 'none', borderRadius: '0 0 10px 10px',
                      zIndex: 1000, maxHeight: '260px', overflowY: 'auto',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    }}>
                      {nameSuggestions.map((place, i) => {
                        // Build clean display name
                        const parts = place.display_name.split(',').map(p => p.trim());
                        const mainName = place.namedetails?.name
                          || place.address?.neighbourhood
                          || place.address?.suburb
                          || place.address?.road
                          || parts[0];

                        // Context: city / district / state
                        const city    = place.address?.city || place.address?.town || place.address?.village || '';
                        const district= place.address?.county || place.address?.state_district || '';
                        const state   = place.address?.state || '';
                        const context = [city, district, state].filter(Boolean).join(', ');

                        // Place type icon
                        const typeMap = {
                          neighbourhood:'🏘️', suburb:'🏘️', quarter:'🏘️',
                          road:'🛣️', residential:'🏠', street:'🛣️',
                          amenity:'🏢', school:'🏫', college:'🎓', university:'🎓',
                          hospital:'🏥', bus_stop:'🚏', station:'🚉',
                          park:'🌳', commercial:'🏪', industrial:'🏭',
                          village:'🏡', town:'🏙️', city:'🌆',
                        };
                        const icon = typeMap[place.type]
                          || typeMap[place.addresstype]
                          || (place.class === 'highway' ? '🛣️' : '📍');

                        // Highlight if Hubli/Hubballi result
                        const isLocal = (place.display_name || '').toLowerCase().includes('hubballi')
                          || (place.display_name || '').toLowerCase().includes('hubli')
                          || (place.display_name || '').toLowerCase().includes('dharwad');

                        return (
                          <button
                            key={place.place_id || i}
                            type="button"
                            onMouseDown={() => handleSelectSuggestion(place)}
                            style={{
                              width: '100%', border: 'none',
                              padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                              borderBottom: i < nameSuggestions.length - 1 ? `1px solid ${t.border}` : 'none',
                              display: 'flex', alignItems: 'flex-start', gap: '8px',
                              background: 'none',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = t.pill}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {mainName}
                                </span>
                              </div>
                              {context && (
                                <div style={{ fontSize: '11px', color: t.subtext, marginTop: '2px' }}>{context}</div>
                              )}
                              <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px', fontFamily: 'monospace' }}>
                                {parseFloat(place.lat).toFixed(5)}, {parseFloat(place.lon).toFixed(5)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      <div style={{ padding: '5px 10px', fontSize: '10px', color: '#aaa', borderTop: `1px solid ${t.border}`, textAlign: 'right' }}>
                        © OpenStreetMap Nominatim
                      </div>
                    </div>
                  )}
                </div>

                <Input placeholder="Description (optional)" value={newStop.description}
                  onChange={v => setNewStop(s => ({ ...s, description: v }))} />

                {/* Lat / Lng row — filled automatically by map picker or GPS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Input type="number" step="any" placeholder="Latitude"
                    value={newStop.latitude} onChange={v => setNewStop(s => ({ ...s, latitude: v }))} />
                  <Input type="number" step="any" placeholder="Longitude"
                    value={newStop.longitude} onChange={v => setNewStop(s => ({ ...s, longitude: v }))} />
                </div>

                {/* Location helper buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={useMyLocation} disabled={locLoading}
                    style={{
                      flex: 1, padding: '9px', background: locLoading ? '#ccc' : '#1565c0',
                      color: '#fff', border: 'none', borderRadius: '7px',
                      fontSize: '13px', fontWeight: '600', cursor: locLoading ? 'not-allowed' : 'pointer',
                    }}>
                    {locLoading ? '⏳ Getting GPS...' : '📍 Use My Location'}
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setShowMapPicker(true); }}
                    style={{
                      flex: 1, padding: '9px',
                      background: '#6a1b9a', color: '#fff',
                      border: 'none', borderRadius: '7px',
                      fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    }}>
                    🗺️ Open Google Maps
                  </button>
                </div>

                {pickedCoords && (
                  <div style={{ padding: '8px 10px', background: '#e8f5e9', borderRadius: '8px', fontSize: '12px', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ✅ Location set: {pickedCoords.lat.toFixed(5)}, {pickedCoords.lng.toFixed(5)}
                    <button type="button" onClick={e => { e.preventDefault(); setShowMapPicker(true); }}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#1565c0', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                      Change
                    </button>
                  </div>
                )}

                <button type="submit" style={submitBtn('#1565c0')}>
                  + Add Stop
                </button>
              </form>

              {/* Google Maps fullscreen picker — rendered via portal so it's truly fullscreen */}
              {showMapPicker && createPortal(
                <GoogleMapPicker
                  initialLat={pickedCoords?.lat || mapCenter[0]}
                  initialLng={pickedCoords?.lng || mapCenter[1]}
                  stopName={newStop.name}
                  onPick={(lat, lng) => {
                    setPickedCoords({ lat, lng });
                    setNewStop(s => ({
                      ...s,
                      latitude: lat.toFixed(7),
                      longitude: lng.toFixed(7),
                    }));
                    setShowMapPicker(false);
                  }}
                  onClose={() => setShowMapPicker(false)}
                />,
                document.body
              )}
            </div>

            {/* Stops list */}
            <div style={card}>
              <p style={cardHead}>All Stops ({stops.length})</p>
              <div style={{ maxHeight: '520px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stops.length === 0 && <Empty text="No stops yet — add one on the left" />}
                {stops.map((s, i) => (
                  <div key={s._id} style={listRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <div style={{
                        background: '#1565c0', color: '#fff',
                        width: '26px', height: '26px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: '700', flexShrink: 0,
                      }}>{i + 1}</div>
                      <div>
                        <p style={{ fontWeight: '700', fontSize: '14px', margin: 0 }}>🚏 {s.name}</p>
                        <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0', fontFamily: 'monospace' }}>
                          {s.location.coordinates[1].toFixed(5)}, {s.location.coordinates[0].toFixed(5)}
                        </p>
                        {s.description && (
                          <p style={{ fontSize: '11px', color: '#aaa', margin: '1px 0 0' }}>{s.description}</p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteStop(s._id)} style={delBtn}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ ROUTES TAB ═══════════ */}
        {activeTab === 'routes' && (
          <div className='admin-2col'>
            <div style={card}>
              <p style={cardHead}>Create Route</p>
              <form onSubmit={handleCreateRoute} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Input placeholder="Route Name (e.g. Route 1 – City to Campus)"
                  value={newRoute.routeName} onChange={v => setNewRoute(r => ({ ...r, routeName: v }))} required />

                <div>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '6px' }}>
                    Select stops <em>in order</em> the bus visits them:
                  </p>
                  <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                    {stops.length === 0 && <p style={{ padding: '12px', color: '#aaa', fontSize: '13px' }}>Add stops first</p>}
                    {stops.map(s => (
                      <label key={s._id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', cursor: 'pointer',
                        background: newRoute.selectedStopIds.includes(s._id) ? '#f3e5f5' : 'transparent',
                        borderBottom: '1px solid #f5f5f5',
                      }}>
                        <input type="checkbox"
                          checked={newRoute.selectedStopIds.includes(s._id)}
                          onChange={() => toggleStopInRoute(s._id)}
                          style={{ width: '15px', height: '15px' }}
                        />
                        <span style={{ fontSize: '14px', flex: 1 }}>{s.name}</span>
                        {newRoute.selectedStopIds.includes(s._id) && (
                          <span style={{ fontSize: '12px', color: '#6a1b9a', fontWeight: '700' }}>
                            #{newRoute.selectedStopIds.indexOf(s._id) + 1}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                    {newRoute.selectedStopIds.length} stop(s) selected
                  </p>
                </div>

                <button type="submit" style={submitBtn('#2e7d32')}>+ Create Route</button>
              </form>
            </div>

            <div style={card}>
              <p style={cardHead}>All Routes ({routes.length})</p>
              <div style={{ maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {routes.length === 0 && <Empty text="No routes yet" />}
                {routes.map(r => (
                  <div key={r._id} style={{ ...listRow, flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <p style={{ fontWeight: '700', fontSize: '14px', margin: 0 }}>🛣️ {r.routeName}</p>
                      <button onClick={() => handleDeleteRoute(r._id)} style={delBtn}>✕</button>
                    </div>
                    <div style={{ paddingLeft: '4px' }}>
                      {r.stops.map((s, i) => (
                        <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <div style={{
                            width: '18px', height: '18px', borderRadius: '50%',
                            background: i === 0 ? '#2e7d32' : i === r.stops.length - 1 ? '#c62828' : '#1565c0',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px', fontWeight: '700', flexShrink: 0,
                          }}>{i + 1}</div>
                          <span style={{ fontSize: '13px', color: '#444' }}>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ BUSES TAB ═══════════ */}
        {activeTab === 'buses' && (
          <div className='admin-2col'>

            {/* Add Bus Form */}
            <div style={card}>
              <p style={cardHead}>Add New Bus</p>
              <form onSubmit={handleCreateBus} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* College Bus Number — the visible number students see */}
                <div>
                  <label style={labelSt}>College Bus Number (shown to students)</label>

                  {/* Quick-pick grid 1–20 */}
                  <div style={{ className: 'bus-num-grid-admin', style: { marginTop: '6px' } }}>
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(n => {
                      const taken = buses.some(b => b.collegeNumber === n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNewBus(b => ({ ...b, collegeNumber: b.collegeNumber === n ? '' : n }))}
                          title={taken ? `Already assigned to ${buses.find(b => b.collegeNumber === n)?.busNumber}` : `Bus ${n}`}
                          style={{
                            padding: '8px 0',
                            border: '2px solid',
                            borderColor: newBus.collegeNumber === n ? '#6a1b9a' : t.inputBorder,
                            borderRadius: '8px',
                            background: newBus.collegeNumber === n ? '#6a1b9a' : t.input,
                            color: newBus.collegeNumber === n ? '#fff' : t.text,
                            fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                            opacity: taken ? 0.35 : 1,
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>

                  {/* Manual entry for numbers > 20 */}
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: t.subtext, whiteSpace: 'nowrap' }}>
                      Or enter manually:
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      placeholder="e.g. 21, 35..."
                      value={newBus.collegeNumber > 20 ? newBus.collegeNumber : ''}
                      onChange={e => {
                        const v = parseInt(e.target.value);
                        if (!e.target.value) { setNewBus(b => ({ ...b, collegeNumber: '' })); return; }
                        if (v >= 1) setNewBus(b => ({ ...b, collegeNumber: v }));
                      }}
                      style={{
                        flex: 1, padding: '8px 10px',
                        border: `2px solid ${newBus.collegeNumber > 20 ? '#6a1b9a' : t.inputBorder}`,
                        borderRadius: '8px', fontSize: '14px', fontWeight: '700',
                        outline: 'none', background: t.input, color: t.text,
                        boxSizing: 'border-box',
                      }}
                    />
                    {newBus.collegeNumber > 20 && (
                      <button
                        type="button"
                        onClick={() => setNewBus(b => ({ ...b, collegeNumber: '' }))}
                        style={{ background: 'none', border: 'none', color: t.subtext, cursor: 'pointer', fontSize: '16px' }}
                      >✕</button>
                    )}
                  </div>

                  {/* Selected indicator */}
                  {newBus.collegeNumber ? (
                    <p style={{ fontSize: '12px', color: '#6a1b9a', fontWeight: '700', marginTop: '6px' }}>
                      ✅ Selected: Bus {newBus.collegeNumber}
                      {buses.some(b => b.collegeNumber === newBus.collegeNumber) && (
                        <span style={{ color: '#c62828', marginLeft: '8px' }}>
                          ⚠️ Already assigned to {buses.find(b => b.collegeNumber === newBus.collegeNumber)?.busNumber}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p style={{ fontSize: '11px', color: t.subtext, marginTop: '6px' }}>
                      No number selected — optional but recommended
                    </p>
                  )}
                </div>

                {/* License plate / internal bus number */}
                <div>
                  <label style={labelSt}>License Plate / Internal ID</label>
                  <input
                    type="text" placeholder="e.g. KA25F1001"
                    value={newBus.busNumber}
                    onChange={e => setNewBus(b => ({ ...b, busNumber: e.target.value }))}
                    required
                    style={{ ...inpSt(t), marginTop: '5px' }}
                  />
                </div>

                <div>
                  <label style={labelSt}>Default Driver Name</label>
                  <input
                    type="text" placeholder="Driver full name"
                    value={newBus.driverName}
                    onChange={e => setNewBus(b => ({ ...b, driverName: e.target.value }))}
                    required
                    style={{ ...inpSt(t), marginTop: '5px' }}
                  />
                </div>

                {/* Driver Password — set by admin, driver uses this to login */}
                <div>
                  <label style={labelSt}>Driver Password</label>
                  <div style={{ position: 'relative', marginTop: '5px' }}>
                    <input
                      type={newBus.showPwd ? 'text' : 'password'}
                      placeholder="Set a password for this driver"
                      value={newBus.driverPassword || ''}
                      onChange={e => setNewBus(b => ({ ...b, driverPassword: e.target.value }))}
                      required
                      style={{ ...inpSt(t), paddingRight: '40px' }}
                    />
                    <button type="button"
                      onClick={() => setNewBus(b => ({ ...b, showPwd: !b.showPwd }))}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                      {newBus.showPwd ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                    Driver will enter their Bus Number + this password to log in
                  </p>
                </div>

                <div>
                  <label style={labelSt}>Assign Route</label>
                  <select value={newBus.route} required
                    onChange={e => setNewBus(b => ({ ...b, route: e.target.value }))}
                    style={{ ...inpSt(t), marginTop: '5px' }}>
                    <option value="">-- Select Route --</option>
                    {routes.map(r => <option key={r._id} value={r.routeName}>{r.routeName}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelSt}>Capacity (seats)</label>
                  <input type="number" placeholder="50"
                    value={newBus.capacity}
                    onChange={e => setNewBus(b => ({ ...b, capacity: e.target.value }))}
                    style={{ ...inpSt(t), marginTop: '5px' }}
                  />
                </div>

                <button type="submit" style={submitBtn('#6a1b9a')}>+ Add Bus</button>
              </form>
            </div>

            {/* Bus list */}
            <div style={card}>
              <p style={cardHead}>All Buses ({buses.length})</p>

              {/* Grid view of college numbers */}
              {buses.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '14px' }}>
                  {buses
                    .filter(b => b.collegeNumber)
                    .sort((a, b) => a.collegeNumber - b.collegeNumber)
                    .map(b => (
                      <div key={b._id} style={{
                        background: '#6a1b9a', color: '#fff',
                        borderRadius: '8px', padding: '6px 4px',
                        textAlign: 'center', fontSize: '13px', fontWeight: '700',
                        title: b.busNumber,
                      }}>
                        🚌 {b.collegeNumber}
                      </div>
                    ))}
                </div>
              )}

              <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {buses.length === 0 && <Empty text="No buses yet" />}
                {buses
                  .sort((a, b) => (a.collegeNumber || 999) - (b.collegeNumber || 999))
                  .map(b => (
                    <div key={b._id} style={listRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        {/* College number badge */}
                        <div style={{
                          background: b.collegeNumber ? '#6a1b9a' : '#9e9e9e',
                          color: '#fff', borderRadius: '8px',
                          width: '36px', height: '36px', flexShrink: 0,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: b.collegeNumber ? '15px' : '10px',
                          fontWeight: '800', lineHeight: 1,
                        }}>
                          {b.collegeNumber ? (
                            <><span style={{ fontSize: '9px', opacity: 0.8, fontWeight: '500' }}>BUS</span>{b.collegeNumber}</>
                          ) : '—'}
                        </div>
                        <div>
                          <p style={{ fontWeight: '700', fontSize: '14px', margin: 0, color: t.text }}>
                            {b.busNumber}
                          </p>
                          <p style={{ fontSize: '11px', color: t.subtext, margin: '2px 0 0' }}>Driver: {b.driverName}</p>
                          <p style={{ fontSize: '11px', color: t.subtext }}>Route: {b.route}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteBus(b._id)} style={delBtn}>✕</button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reusable helpers ──
const card       = { background: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' };
const cardHead   = { fontSize: '14px', fontWeight: '700', color: '#333', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const listRow    = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9f9f9', borderRadius: '8px', padding: '10px 12px', gap: '8px' };
const delBtn     = { background: '#ffebee', border: 'none', borderRadius: '6px', color: '#c62828', width: '28px', height: '28px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', flexShrink: 0 };
const selectSt   = { padding: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%' };
const submitBtn  = (bg) => ({ padding: '11px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginTop: '4px' });
const labelSt    = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' };
const inpSt      = (t) => ({ width: '100%', padding: '10px', border: `1px solid ${t?.inputBorder || '#e0e0e0'}`, borderRadius: '8px', fontSize: '14px', outline: 'none', background: t?.input || '#fff', color: t?.text || '#333', boxSizing: 'border-box' });

function Input({ type = 'text', placeholder, value, onChange, required, step }) {
  return (
    <input type={type} step={step} placeholder={placeholder} value={value}
      onChange={e => onChange(e.target.value)} required={required}
      style={{ padding: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
    />
  );
}

function Empty({ text }) {
  return <p style={{ color: '#bbb', fontSize: '13px', textAlign: 'center', padding: '24px' }}>{text}</p>;
}

/* ─────────────────────────────────────────────────────────────
   Google Maps Fullscreen Picker
   Opens a fullscreen modal with:
   1. Google Maps iframe (full place names, search, satellite)
   2. A coordinate paste box — paste any Google Maps URL or
      "lat, lng" string and it extracts the coordinates
   3. Manual lat/lng entry as fallback
───────────────────────────────────────────────────────────── */
function GoogleMapPicker({ initialLat, initialLng, stopName, onPick, onClose }) {
  const [pasteValue, setPasteValue] = useState('');
  const [manualLat, setManualLat]   = useState(initialLat?.toFixed(6) || '');
  const [manualLng, setManualLng]   = useState(initialLng?.toFixed(6) || '');
  const [parsed, setParsed]         = useState(null);
  const [parseError, setParseError] = useState('');
  const [activeMethod, setActiveMethod] = useState('map'); // 'map' | 'paste' | 'manual'

  // Build Google Maps embed URL centred on initial coords
  const searchQuery = stopName
    ? encodeURIComponent(stopName + ' Hubballi Karnataka')
    : `${initialLat},${initialLng}`;
  const gmEmbedUrl = `https://maps.google.com/maps?q=${searchQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  // Parse a Google Maps URL or plain "lat, lng" from paste box
  const parsePaste = (raw) => {
    setParseError('');
    setParsed(null);
    if (!raw.trim()) return;

    // Try extracting from Google Maps URL patterns:
    // https://www.google.com/maps/@15.3647,75.1240,15z
    // https://maps.google.com/?q=15.3647,75.1240
    // https://www.google.com/maps/place/.../@15.3647,75.1240,15z
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,           // @lat,lng in URL
      /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,      // ?q=lat,lng
      /\/(-?\d+\.\d+),(-?\d+\.\d+),\d+z/,     // /lat,lng,15z
    ];

    for (const p of patterns) {
      const m = raw.match(p);
      if (m) {
        const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          setParsed({ lat, lng });
          setManualLat(lat.toFixed(6));
          setManualLng(lng.toFixed(6));
          return;
        }
      }
    }

    // Try plain "15.3647, 75.1240" or "15.3647 75.1240"
    const plain = raw.trim().replace(/\s+/g, ' ').split(/[,\s]+/);
    if (plain.length >= 2) {
      const lat = parseFloat(plain[0]), lng = parseFloat(plain[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setParsed({ lat, lng });
        setManualLat(lat.toFixed(6));
        setManualLng(lng.toFixed(6));
        return;
      }
    }

    setParseError('Could not read coordinates. Try pasting a Google Maps link or "lat, lng".');
  };

  const handleConfirm = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) {
      setParseError('Enter valid latitude and longitude.');
      return;
    }
    onPick(lat, lng);
  };

  // Open Google Maps in a new tab for the admin to find coords
  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/${searchQuery}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: '#6a1b9a', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: '12px',
        flexShrink: 0,
      }}>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer' }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>
            📍 Set Stop Location
          </div>
          {stopName && (
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px' }}>{stopName}</div>
          )}
        </div>
        <button onClick={openGoogleMaps}
          style={{
            background: '#fff', color: '#6a1b9a', border: 'none',
            borderRadius: '8px', padding: '6px 12px',
            fontSize: '12px', fontWeight: '700', cursor: 'pointer',
          }}>
          Open in Google Maps ↗
        </button>
      </div>

      {/* Method tabs */}
      <div style={{ background: '#fff', display: 'flex', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
        {[
          { key: 'map',    label: '🗺️ Google Maps Preview' },
          { key: 'paste',  label: '🔗 Paste Maps Link' },
          { key: 'manual', label: '✏️ Enter Manually' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveMethod(tab.key)}
            style={{
              flex: 1, padding: '10px 6px', border: 'none',
              borderBottom: activeMethod === tab.key ? '3px solid #6a1b9a' : '3px solid transparent',
              background: 'none', fontWeight: activeMethod === tab.key ? '700' : '500',
              color: activeMethod === tab.key ? '#6a1b9a' : '#666',
              cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── MAP TAB ── */}
      {activeMethod === 'map' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Google Maps iframe */}
          <div style={{ flex: 1, position: 'relative' }}>
            <iframe
              title="Google Maps"
              src={gmEmbedUrl}
              style={{ width: '100%', height: '100%', border: 'none', minHeight: '300px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          {/* Instructions */}
          <div style={{ background: '#fff', padding: '12px 16px', flexShrink: 0 }}>
            <p style={{ fontSize: '13px', color: '#555', marginBottom: '10px', lineHeight: '1.5' }}>
              <strong>How to get coordinates:</strong><br />
              1. Tap <strong>"Open in Google Maps ↗"</strong> above → find your stop<br />
              2. Long-press the exact spot → coordinates appear at the bottom<br />
              3. Tap the coordinates → tap Copy → come back and use <strong>Paste Maps Link</strong> tab
            </p>
            <button onClick={() => setActiveMethod('paste')} style={{
              width: '100%', padding: '11px',
              background: '#6a1b9a', color: '#fff', border: 'none',
              borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
            }}>
              → Go to Paste Link tab
            </button>
          </div>
        </div>
      )}

      {/* ── PASTE TAB ── */}
      {activeMethod === 'paste' && (
        <div style={{ flex: 1, background: '#f9f9f9', padding: '20px 16px', overflowY: 'auto' }}>
          <p style={{ fontWeight: '700', fontSize: '14px', color: '#333', marginBottom: '6px' }}>
            Paste Google Maps link or coordinates
          </p>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px', lineHeight: '1.6' }}>
            Open Google Maps → find your stop → long-press to drop a pin → tap the coordinates shown at the bottom → tap <strong>Share</strong> → copy the link and paste it here.
          </p>

          <textarea
            value={pasteValue}
            onChange={e => { setPasteValue(e.target.value); parsePaste(e.target.value); }}
            placeholder={`Paste any of these:\n• https://maps.google.com/maps?q=15.3647,75.1240\n• https://www.google.com/maps/@15.364,75.124,15z\n• 15.3647, 75.1240`}
            rows={5}
            style={{
              width: '100%', padding: '12px', border: '1.5px solid #6a1b9a',
              borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace',
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              background: '#fff',
            }}
          />

          {parseError && (
            <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginTop: '8px' }}>
              ⚠️ {parseError}
            </div>
          )}

          {parsed && (
            <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginTop: '8px', fontWeight: '600' }}>
              ✅ Detected: {parsed.lat.toFixed(6)}, {parsed.lng.toFixed(6)}
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!parsed && (!manualLat || !manualLng)}
            style={{
              width: '100%', marginTop: '16px', padding: '13px',
              background: parsed ? '#2e7d32' : '#ccc',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: '700',
              cursor: parsed ? 'pointer' : 'not-allowed',
            }}>
            {parsed ? '✅ Use This Location' : 'Paste a link first'}
          </button>
        </div>
      )}

      {/* ── MANUAL TAB ── */}
      {activeMethod === 'manual' && (
        <div style={{ flex: 1, background: '#f9f9f9', padding: '20px 16px', overflowY: 'auto' }}>
          <p style={{ fontWeight: '700', fontSize: '14px', color: '#333', marginBottom: '6px' }}>
            Enter coordinates manually
          </p>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
            Open Google Maps → right-click (desktop) or long-press (mobile) on the location → coordinates appear. Copy them here.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '5px' }}>LATITUDE</label>
              <input
                type="number" step="any" placeholder="e.g. 15.364700"
                value={manualLat}
                onChange={e => { setManualLat(e.target.value); setParseError(''); }}
                style={{ width: '100%', padding: '11px', border: '1.5px solid #6a1b9a', borderRadius: '8px', fontSize: '15px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '5px' }}>LONGITUDE</label>
              <input
                type="number" step="any" placeholder="e.g. 75.124000"
                value={manualLng}
                onChange={e => { setManualLng(e.target.value); setParseError(''); }}
                style={{ width: '100%', padding: '11px', border: '1.5px solid #6a1b9a', borderRadius: '8px', fontSize: '15px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {parseError && (
            <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginTop: '12px' }}>
              ⚠️ {parseError}
            </div>
          )}

          {manualLat && manualLng && !isNaN(parseFloat(manualLat)) && !isNaN(parseFloat(manualLng)) && (
            <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>
              📍 {parseFloat(manualLat).toFixed(5)}, {parseFloat(manualLng).toFixed(5)}
            </div>
          )}

          <button onClick={handleConfirm}
            style={{
              width: '100%', marginTop: '16px', padding: '13px',
              background: '#6a1b9a', color: '#fff', border: 'none',
              borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
            }}>
            ✅ Confirm This Location
          </button>
        </div>
      )}
    </div>
  );
}








