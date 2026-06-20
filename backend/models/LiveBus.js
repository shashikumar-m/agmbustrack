const mongoose = require("mongoose");

const liveBusSchema = new mongoose.Schema({
  busNumber: {
    type: String,
    required: true
  },

  driverName: String,

  route: String,

  latitude: {
    type: Number,
    required: true
  },

  longitude: {
    type: Number,
    required: true
  },

  currentStop: String,

  nextStop: String,

  speed: {
    type: Number,
    default: 0
  },

  lastUpdated: {
    type: Date,
    default: Date.now
  },

  busStatus: {
    type: String,
    enum: ["on_time", "delayed", "bus_full", "breakdown"],
    default: "on_time"
  },

  tripActive: {
    type: Boolean,
    default: false,
  },

  tripStartedAt: {
    type: Date,
    default: null,
  }
});

module.exports = mongoose.model("LiveBus", liveBusSchema);