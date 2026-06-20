const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., "Main Gate", "City Center"
  // GeoJSON format for location (Perfect for maps!)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude] - Note: GeoJSON uses Long, Lat order!
      required: true
    }
  },
  description: String
}, { timestamps: true });

// Create a 2dsphere index so we can do location-based queries later
stopSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Stop', stopSchema);