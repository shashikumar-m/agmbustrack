// Single source of truth for the API URL.
// In dev: reads from .env → http://localhost:5000/api
// In prod: reads from .env.production → your deployed backend URL
export const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
