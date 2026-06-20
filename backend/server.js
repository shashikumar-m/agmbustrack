const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Allow requests from any origin in dev, restrict in production
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : true; // true = allow all (dev mode)

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => { console.log('✅ MongoDB Atlas Connected'); })
  .catch((err) => { console.log('❌ MongoDB Error:', err.message); process.exit(1); });

app.use('/api/admin',   require('./routes/adminRoutes'));
app.use('/api/driver',  require('./routes/driverRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));

app.get('/', (req, res) => {
  res.json({ message: 'Bus Tracking API is running 🚌', env: process.env.NODE_ENV || 'development' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});