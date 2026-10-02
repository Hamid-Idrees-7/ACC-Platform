// Backend address. Set VITE_API_ORIGIN for the live site (see .env.example); without it the
// app uses the https port Visual Studio runs the API on.
export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || "https://localhost:7116").replace(/\/+$/, "");
export const API_BASE_URL = `${API_ORIGIN}/api`;
export const LIVE_HUB_URL = `${API_ORIGIN}/hubs/live`;

export const HEALTH_URL = `${API_ORIGIN}/api/health`;

export const SERVER_UNREACHABLE_EVENT = "acc-server-unreachable";
