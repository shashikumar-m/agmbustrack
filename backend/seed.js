/**
 * Seed script — run once to populate demo data
 * Usage: node seed.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const Stop    = require("./models/Stop");
const Route   = require("./models/Route");
const Bus     = require("./models/Bus");
const LiveBus = require("./models/LiveBus");

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // ── Clear old demo data ──
  await Promise.all([
    Stop.deleteMany({}),
    Route.deleteMany({}),
    Bus.deleteMany({}),
    LiveBus.deleteMany({}),
  ]);
  console.log("🗑️  Cleared old data");

  // ── 1. Stops (Hubballi area, Karnataka) ──
  // coordinates: [longitude, latitude]
  const stopsData = [
    { name: "Hubballi Bus Stand",   coordinates: [75.1240, 15.3647], description: "Main bus terminal" },
    { name: "Navanagar",            coordinates: [75.1318, 15.3720], description: "Navanagar cross" },
    { name: "Gokul Road",           coordinates: [75.1390, 15.3795], description: "Gokul Road junction" },
    { name: "Unkal Cross",          coordinates: [75.1452, 15.3860], description: "Unkal lake area" },
    { name: "BVB College",          coordinates: [75.1520, 15.3940], description: "BVB Engineering campus" },
    { name: "KCD Circle",           coordinates: [75.1580, 15.4010], description: "KCD cross" },
    { name: "AGM College",          coordinates: [75.1630, 15.4075], description: "Destination — college" },
  ];

  const savedStops = await Stop.insertMany(
    stopsData.map(s => ({
      name: s.name,
      description: s.description,
      location: { type: "Point", coordinates: s.coordinates },
    }))
  );
  console.log(`🚏 Created ${savedStops.length} stops`);

  // Map name → _id for easy lookup
  const stopMap = {};
  savedStops.forEach(s => { stopMap[s.name] = s._id; });

  // ── 2. Routes ──
  const routesData = [
    {
      routeName: "Route 1 – Hubballi Bus Stand to AGM College",
      stopIds: savedStops.map(s => s._id), // all stops in order
    },
    {
      routeName: "Route 2 – Navanagar to AGM College (Express)",
      stopIds: [
        stopMap["Navanagar"],
        stopMap["Gokul Road"],
        stopMap["Unkal Cross"],
        stopMap["AGM College"],
      ],
    },
  ];

  const savedRoutes = await Route.insertMany(
    routesData.map(r => ({ routeName: r.routeName, stops: r.stopIds, isActive: true }))
  );
  console.log(`🛣️  Created ${savedRoutes.length} routes`);

  // ── 3. Buses ──
  const busesData = [
    { busNumber: "KA25F1001", collegeNumber: 1, driverName: "Ravi Kumar",   driverPassword: "ravi123",   route: savedRoutes[0].routeName, capacity: 52 },
    { busNumber: "KA25F1002", collegeNumber: 2, driverName: "Suresh Patil", driverPassword: "suresh123", route: savedRoutes[0].routeName, capacity: 52 },
    { busNumber: "KA25F2001", collegeNumber: 3, driverName: "Mahesh Naik",  driverPassword: "mahesh123", route: savedRoutes[1].routeName, capacity: 40 },
  ];

  await Bus.insertMany(busesData);
  console.log(`🚌 Created ${busesData.length} buses`);

  // ── 4. LiveBus — bus KA25F1001 is currently at "Gokul Road" heading to "Unkal Cross"
  //    Coordinates near Gokul Road stop
  await LiveBus.create({
    busNumber:   "KA25F1001",
    driverName:  "Ravi Kumar",
    route:       savedRoutes[0].routeName,
    latitude:    15.3795,
    longitude:   75.1390,
    currentStop: "Gokul Road",
    nextStop:    "Unkal Cross",
    speed:       28,
    lastUpdated: new Date(),
  });

  // ── 5. LiveBus — bus KA25F2001 is at "Navanagar" (express route)
  await LiveBus.create({
    busNumber:   "KA25F2001",
    driverName:  "Mahesh Naik",
    route:       savedRoutes[1].routeName,
    latitude:    15.3720,
    longitude:   75.1318,
    currentStop: "Navanagar",
    nextStop:    "Gokul Road",
    speed:       35,
    lastUpdated: new Date(),
  });

  console.log("📍 Created 2 live buses");

  console.log("\n✅ SEED COMPLETE — demo data ready!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Try this in the student app:");
  console.log("  From : Hubballi Bus Stand");
  console.log("  To   : AGM College");
  console.log("  → Should show KA25F1001 (Ravi Kumar) LIVE");
  console.log("");
  console.log("  Or track directly: /track/KA25F1001");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
