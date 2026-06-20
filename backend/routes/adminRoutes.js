const express = require('express');
const router = express.Router();
const Stop = require('../models/Stop');
const Route = require('../models/Route');
const Bus = require('../models/Bus');

// --- STOP ROUTES ---
// Get all stops
router.get('/stops', async (req, res) => {
  try {
    const stops = await Stop.find().sort({ name: 1 });
    res.json(stops);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new stop
router.post('/stops', async (req, res) => {
  const { name, latitude, longitude, description } = req.body;
  
  // Note: GeoJSON requires [longitude, latitude] order!
  const newStop = new Stop({
    name,
    description,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude] 
    }
  });

  try {
    const savedStop = await newStop.save();
    res.status(201).json(savedStop);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a stop
router.delete('/stops/:id', async (req, res) => {
  try {
    await Stop.findByIdAndDelete(req.params.id);
    res.json({ message: 'Stop deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- ROUTE ROUTES ---
// Get all routes (and populate the actual stop details)
router.get('/routes', async (req, res) => {
  try {
    const routes = await Route.find().populate('stops').sort({ routeName: 1 });
    res.json(routes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new route
router.post('/routes', async (req, res) => {
  const { routeName, stopIds } = req.body;
  
  const newRoute = new Route({
    routeName,
    stops: stopIds // Array of Stop ObjectIds
  });

  try {
    const savedRoute = await newRoute.save();
    res.status(201).json(savedRoute);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Delete a route
router.delete('/routes/:id', async (req, res) => {
  try {
    await Route.findByIdAndDelete(req.params.id);
    res.json({ message: 'Route deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/buses", async (req, res) => {
  try {
    const buses = await Bus.find().sort({ busNumber: 1 });
    res.json(buses);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

router.post("/buses", async (req, res) => {
  try {
    const bus = new Bus(req.body);

    const savedBus = await bus.save();

    res.status(201).json(savedBus);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

router.delete("/buses/:id", async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);
    res.json({ message: "Bus deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;