# 🚌 AGM Bus Track

Real-time college bus tracking web app built for **AGM College, Hubballi**.  
Students track live bus location, drivers share GPS, admins manage routes — all in one PWA.

---

## ✨ Features

### 👩‍🎓 Student
- Search buses by boarding stop → destination stop
- Live bus location on map (OpenStreetMap + Google Maps link)
- ETA to your stop, stops-away count
- Route timeline (like train apps — Arrived / Departed columns)
- Bus number grid (Bus 1, Bus 2 … tap to track directly)
- Set stop alarm — notified when bus is near your stop
- Last-seen indicator when bus goes offline
- Search history (saved locally)
- Live weather at your stop (Open-Meteo, no API key needed)

### 🚗 Driver
- Login with Bus Number + Password (set by admin)
- Bus is locked to your account — no other driver can take it
- GPS auto-detects current stop from route coordinates (Haversine)
- Manual stop override if GPS is wrong
- Broadcast status: On Time / Running Late / Bus Full / Breakdown
- SOS button — sends emergency alert + GPS to admin
- Live mini-map showing your position
- Active trip tracking — prevents duplicate trips on same bus

### 🛠️ Admin
- **Stops**: Add with Google Maps picker / GPS / manual lat-lng
  - Smart autocomplete (Nominatim OSM, biased to Hubballi/Karnataka)
- **Routes**: Build ordered stop sequences
- **Buses**: Assign college number (Bus 1–20+), driver name, password, route
- **Live Map**: Real-time map of all active buses with status colours
- Bus activity: SOS alerts, breakdown status

### 📱 PWA
- Installable on Android & iOS ("Add to Home Screen")
- College splash screen (4 seconds) with logo
- Offline caching: map tiles (7 days), API (5 min), weather (10 min)
- Push notification permission prompt
- Dark mode (persists across sessions)

---

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, React Router, Leaflet / React-Leaflet |
| PWA | vite-plugin-pwa, Workbox |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB Atlas |
| Geocoding | Nominatim (OpenStreetMap) — free, no key |
| Weather | Open-Meteo — free, no key |
| Maps | OpenStreetMap tiles + Google Maps deeplinks |

---

## 📁 Project Structure

```
agmbustrack/
├── backend/
│   ├── models/
│   │   ├── Bus.js          # Bus + driver credentials
│   │   ├── LiveBus.js      # Real-time GPS + trip state
│   │   ├── Route.js        # Ordered stop sequences
│   │   └── Stop.js         # GPS coordinates (GeoJSON)
│   ├── routes/
│   │   ├── adminRoutes.js  # CRUD for stops/routes/buses
│   │   ├── driverRoutes.js # Login, GPS update, trip end, SOS
│   │   └── studentRoutes.js# Search, ETA, live bus, SOS
│   ├── server.js
│   ├── seed.js             # Demo data seeder
│   └── .env                # ← NOT committed (contains MongoDB URI)
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── HomePage.jsx       # Role selector (student/driver/admin)
    │   │   ├── StudentPage.jsx    # Stop search + bus number grid
    │   │   ├── SearchResultsPage.jsx
    │   │   ├── TrackBusPage.jsx   # Timeline + map + alarm
    │   │   ├── DriverPage.jsx     # Login + GPS dashboard
    │   │   └── LiveMapPage.jsx    # Admin all-buses map
    │   ├── AdminDashboard.jsx
    │   ├── ThemeContext.jsx       # Dark/light mode
    │   ├── NotificationContext.jsx
    │   ├── NotificationUI.jsx     # Toast, bell, install sheet
    │   ├── SplashScreen.jsx       # College splash on load
    │   ├── usePWAInstall.js
    │   ├── useNotifications.js
    │   └── config.js              # API base URL (reads from .env)
    ├── public/
    │   ├── icons/                 # PWA icons (generated from college logo)
    │   └── apple-touch-icon.png
    ├── .env                       # ← NOT committed
    └── .env.production            # ← NOT committed
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)

### 1. Clone
```bash
git clone https://github.com/shashikumar-m/agmbustrack.git
cd agmbustrack
```

### 2. Backend setup
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/bus_tracking?retryWrites=true&w=majority
PORT=5000
NODE_ENV=development
```

Start backend:
```bash
npm run dev
```

### 3. Seed demo data (optional)
```bash
cd backend
node seed.js
```

This creates:
- 7 stops around Hubballi
- 2 routes  
- 3 buses with driver credentials:
  | Bus | Driver | Password |
  |-----|--------|----------|
  | KA25F1001 | Ravi Kumar | `ravi123` |
  | KA25F1002 | Suresh Patil | `suresh123` |
  | KA25F2001 | Mahesh Naik | `mahesh123` |

### 4. Frontend setup
```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

Start frontend:
```bash
npm run dev
```

Open **http://localhost:5173**

---

## 🔑 Default Passwords

| Role | Access | Password |
|------|--------|----------|
| Driver | Home → 🚗 Driver | `driver123` (opens driver login page) |
| Admin | Home → 🛠️ Admin | `admin123` |
| Driver Login | Bus-specific | Set per bus by admin (see seed above) |

---

## 🌐 Deployment

### Backend (Render / Railway)
Set environment variables:
```
MONGODB_URI = <your Atlas URI>
PORT = 5000
FRONTEND_URL = https://your-frontend.vercel.app
```

### Frontend (Vercel / Netlify)
Set environment variable:
```
VITE_API_URL = https://your-backend.onrender.com/api
```

Then deploy the `frontend/dist/` folder after running `npm run build`.

---

## 📸 Screenshots

| Student Search | Bus Timeline | Driver Dashboard |
|---|---|---|
| Stop-to-stop search with weather | Railway-style arrival/departure | GPS + status broadcast |

---

## 📄 License

MIT — free to use and modify for educational purposes.

---

Built with ❤️ for AGM College, Hubballi
