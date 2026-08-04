import axios from "axios";

// The base URL of our backend API (from Visual Studio)
// Note: use YOUR backend's https port here
const API_BASE_URL = "https://localhost:7116/api";

// Create a pre-configured axios instance for all API calls
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Before every request, attach the JWT token (if the user is logged in)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;