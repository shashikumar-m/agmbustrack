const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  routeName: { type: String, required: true, unique: true }, // e.g., "Route A: Campus to City"
  // Array of Stop IDs in the exact order the bus will visit them
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stop', required: true }], 
  totalDistance: { type: Number, default: 0 }, // in km
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Route', routeSchema);