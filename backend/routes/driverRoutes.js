const express = require("express");
const router  = express.Router();
const LiveBus = require("../models/LiveBus");
const Route   = require("../models/Route");
const Bus     = require("../models/Bus");

// ── POST /api/driver/login ──
// Driver logs in with busNumber (or driverName) + password
router.post("/login", async (req, res) => {
  try {
    const { busNumber, driverName, password } = req.body;

    // Find bus by busNumber OR driverName (case-insensitive)
    let bus = null;
    if (busNumber) {
      bus = await Bus.findOne({ busNumber: busNumber.trim().toUpperCase() });
    }
    if (!bus && driverName) {
      bus = await Bus.findOne({ driverName: { $regex: new RegExp(`^${driverName.trim()}$`, 'i') } });
    }

    if (!bus) {
      return res.status(401).json({ success: false, message: "Bus number or driver name not found." });
    }

    if (bus.driverPassword !== password) {
      return res.status(401).json({ success: false, message: "Wrong password. Contact admin." });
    }

    // Check if this bus is already on an active trip by checking LiveBus
    const liveSession = await LiveBus.findOne({ busNumber: bus.busNumber, tripActive: true });

    res.json({
      success: true,
      driver: {
        busNumber:   bus.busNumber,
        driverName:  bus.driverName,
        route:       bus.route,
        collegeNumber: bus.collegeNumber,
      },
      tripActive: !!liveSession,
      currentTrip: liveSession ? {
        currentStop: liveSession.currentStop,
        nextStop:    liveSession.nextStop,
        speed:       liveSession.speed,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Haversine distance in meters ──
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R    = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLng  = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Auto-detect nearest stop on route from GPS ──
async function detectStops(routeName, latitude, longitude) {
  try {
    const route = await Route.findOne({ routeName }).populate("stops");
    if (!route?.stops?.length) return { currentStop: "", nextStop: "" };
    const stops = route.stops.filter(s => s.location?.coordinates?.length === 2);
    if (!stops.length) return { currentStop: "", nextStop: "" };
    let closestIdx = 0, closestDist = Infinity;
    stops.forEach((stop, i) => {
      const [lng, lat] = stop.location.coordinates;
      const d = distanceMeters(latitude, longitude, lat, lng);
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    });
    return {
      currentStop: stops[closestIdx].name,
      nextStop:    closestIdx + 1 < stops.length ? stops[closestIdx + 1].name : "",
    };
  } catch {
    return { currentStop: "", nextStop: "" };
  }
}

// ── GET /api/driver/active-trips — which buses are currently on a trip ──
router.get("/active-trips", async (req, res) => {
  try {
    const active = await LiveBus.find({ tripActive: true })
      .select("busNumber driverName route tripStartedAt lastUpdated");
    res.json(active);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/driver/end-trip — driver ends their trip ──
router.post("/end-trip", async (req, res) => {
  try {
    const { busNumber } = req.body;
    await LiveBus.findOneAndUpdate(
      { busNumber },
      {
        tripActive:  false,
        busStatus:   "on_time",
        speed:       0,
        lastUpdated: new Date(),
      }
    );
    res.json({ success: true, message: "Trip ended" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/driver/update-location ──
router.post("/update-location", async (req, res) => {
  try {
    const {
      busNumber, driverName, route,
      latitude, longitude, speed,
      manualStop,
      busStatus,
    } = req.body;

    let currentStop, nextStop;
    if (manualStop) {
      const routeDoc = await Route.findOne({ routeName: route }).populate("stops");
      const stops    = routeDoc?.stops || [];
      const idx      = stops.findIndex(s => s.name === manualStop);
      currentStop    = manualStop;
      nextStop       = idx !== -1 && idx + 1 < stops.length ? stops[idx + 1].name : "";
    } else {
      ({ currentStop, nextStop } = await detectStops(route, latitude, longitude));
    }

    let bus = await LiveBus.findOne({ busNumber });

    if (!bus) {
      bus = new LiveBus({
        busNumber, driverName, route,
        latitude, longitude,
        currentStop, nextStop, speed,
        busStatus:      busStatus || "on_time",
        tripActive:     true,
        tripStartedAt:  new Date(),
      });
    } else {
      bus.driverName     = driverName;
      bus.route          = route;
      bus.latitude       = latitude;
      bus.longitude      = longitude;
      bus.currentStop    = currentStop;
      bus.nextStop       = nextStop;
      bus.speed          = speed;
      bus.busStatus      = busStatus || "on_time";
      bus.lastUpdated    = new Date();
      // Mark trip active on first update
      if (!bus.tripActive) {
        bus.tripActive    = true;
        bus.tripStartedAt = new Date();
      }
    }

    await bus.save();
    res.json({ success: true, currentStop, nextStop, busStatus: bus.busStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
