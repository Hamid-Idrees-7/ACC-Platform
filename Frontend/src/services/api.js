import axios from "axios";
import { DEMO_ENDED_EVENT } from "../config/demoConfig";

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

// A demo visitor whose session is over (timer ran out, exited in another tab, or the token
// expired) gets a 401. Tell the app so it can sign the visitor out cleanly.
const isDemoVisitor = () => {
  try {
    return !!JSON.parse(localStorage.getItem("user") || "null")?.demo;
  } catch {
    return false;
  }
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 &&
        (error.response.data?.code === "demo_expired" || isDemoVisitor())) {
      window.dispatchEvent(new Event(DEMO_ENDED_EVENT));
    }
    return Promise.reject(error);
  }
);

export default api;