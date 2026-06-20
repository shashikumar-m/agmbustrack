const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    busNumber: { type: String, required: true, unique: true },
    collegeNumber: { type: Number, default: null },
    driverName: { type: String, required: true },
    driverPassword: { type: String, required: true, default: "driver123" }, // set by admin
    route: { type: String, required: true },
    capacity: { type: Number, default: 50 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bus", busSchema);