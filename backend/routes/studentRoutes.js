const express = require("express");
const router = express.Router();
const LiveBus = require("../models/LiveBus");
const Route = require("../models/Route");
const Stop = require("../models/Stop");

// Haversine distance in meters
function distMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = d => d * Math.PI / 180;
  const dLat = r(lat2 - lat1), dLng = r(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(r(lat1))*Math.cos(r(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Compute ETA in minutes from bus current position to a target stop
function computeETA(bus, routeStops, targetStopName) {
  if (!bus || !routeStops.length) return null;
  const currentIdx = routeStops.findIndex(s => s.name === bus.currentStop);
  const targetIdx  = routeStops.findIndex(s => s.name === targetStopName);
  if (currentIdx === -1 || targetIdx === -1 || targetIdx <= currentIdx) return null;

  // Sum straight-line distances between remaining stops
  let distKm = 0;
  for (let i = currentIdx; i < targetIdx; i++) {
    const a = routeStops[i], b = routeStops[i+1];
    if (a.location?.coordinates && b.location?.coordinates) {
      const [lngA, latA] = a.location.coordinates;
      const [lngB, latB] = b.location.coordinates;
      distKm += distMeters(latA, lngA, latB, lngB) / 1000;
    }
  }

  // Use bus speed (min 10 km/h assumed if GPS says 0)
  const speedKmh = Math.max(bus.speed || 0, 10);
  const etaMins  = Math.round((distKm / speedKmh) * 60);
  const stopsAway = targetIdx - currentIdx;
  return { etaMins, stopsAway, distKm: distKm.toFixed(1) };
}

// Get a single live bus by bus number
router.get("/live-bus/:busNumber", async (req, res) => {
  try {
    const bus = await LiveBus.findOne({ busNumber: req.params.busNumber });
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    res.json(bus);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get all currently live buses
router.get("/live-buses", async (req, res) => {
  try {
    const buses = await LiveBus.find().sort({ lastUpdated: -1 });
    res.json(buses);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Search buses between two stops — includes ETA
router.get("/search", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ message: "from and to stops are required" });

    const routes = await Route.find({ isActive: true }).populate("stops");
    const matchingRoutes = routes.filter(route => {
      const names = route.stops.map(s => s.name);
      const fi = names.indexOf(from), ti = names.indexOf(to);
      return fi !== -1 && ti !== -1 && fi < ti;
    });

    const results = await Promise.all(matchingRoutes.map(async route => {
      const liveBuses = await LiveBus.find({ route: route.routeName });
      // Attach ETA to each live bus
      const busesWithETA = liveBuses.map(bus => {
        const eta = computeETA(bus.toObject(), route.stops, to);
        return { ...bus.toObject(), eta };
      });
      return { route, liveBuses: busesWithETA };
    }));

    res.json(results);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get route details with stops
router.get("/route-stops/:routeName", async (req, res) => {
  try {
    const route = await Route.findOne({
      routeName: decodeURIComponent(req.params.routeName),
    }).populate("stops");
    if (!route) return res.status(404).json({ message: "Route not found" });
    res.json(route);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// SOS alert from driver
router.post("/sos", async (req, res) => {
  try {
    const { busNumber, driverName, latitude, longitude, message } = req.body;
    // Update LiveBus with SOS flag
    await LiveBus.findOneAndUpdate(
      { busNumber },
      {
        busStatus: "breakdown",
        lastUpdated: new Date(),
        ...(latitude && { latitude }),
        ...(longitude && { longitude }),
      }
    );
    // In a real app you'd send push/email here
    console.log(`🆘 SOS from ${driverName} (${busNumber}): ${message} @ ${latitude},${longitude}`);
    res.json({ success: true, message: "SOS alert sent to admin" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;