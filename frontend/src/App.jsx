import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./ThemeContext";
import { NotificationProvider } from "./NotificationContext";
import { ToastStack } from "./NotificationUI";
import HomePage           from "./pages/HomePage";
import StudentPage        from "./pages/StudentPage";
import SearchResultsPage  from "./pages/SearchResultsPage";
import TrackBusPage       from "./pages/TrackBusPage";
import DriverPage         from "./pages/DriverPage";
import AdminDashboard     from "./AdminDashboard";

function ProtectedRoute({ children }) {
  const allowed = sessionStorage.getItem("role");
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"        element={<HomePage />} />
            <Route path="/student" element={<StudentPage />} />
            <Route path="/search"  element={<SearchResultsPage />} />
            <Route path="/track/:busNumber" element={<TrackBusPage />} />
            <Route path="/driver"  element={<ProtectedRoute><DriverPage /></ProtectedRoute>} />
            <Route path="/admin"   element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="*"        element={<Navigate to="/" />} />
          </Routes>

          {/* Global toast notifications — always visible */}
          <ToastStack />
        </BrowserRouter>
      </NotificationProvider>
    </ThemeProvider>
  );
}
