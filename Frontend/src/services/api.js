import axios from "axios";
import { DEMO_ENDED_EVENT } from "../config/demoConfig";
import { SESSION_ENDED_EVENT, RENEW_BEFORE_MS } from "../config/sessionConfig";
import { tokenExpiresAt } from "../utils/token";

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

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

// Demo visitors carry a demo token that ends with the demo (never renewed).
const isDemoVisitor = () => !!readUser()?.demo;

// Sign-in, sign-out and renewal never renew the token or trigger the signed-out handling.
const isAuthCall = (url) => /\/auth\/(login|logout|refresh)$/.test(url || "");

// Renews the token of the current session while the user keeps working. Only one renewal
// runs at a time; every request waiting for it then uses the new token.
let renewing = null;
const renewToken = (token) => {
  if (!renewing) {
    renewing = axios
      .post(`${API_BASE_URL}/auth/refresh`, null, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        // Only if nobody signed out or in meanwhile
        if (res.data?.token && localStorage.getItem("token") === token) {
          localStorage.setItem("token", res.data.token);
        }
      })
      .catch(() => {
        // The request itself gets a 401 if the session is really over.
      })
      .finally(() => {
        renewing = null;
      });
  }
  return renewing;
};

// Before every request, attach the JWT token (if the user is logged in). A token that
// expires within 30 minutes is renewed first.
api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem("token");
  if (token && !isAuthCall(config.url) && !isDemoVisitor()) {
    const expiresAt = tokenExpiresAt(token);
    const left = expiresAt ? expiresAt - Date.now() : null;
    if (left !== null && left > 0 && left < RENEW_BEFORE_MS) {
      await renewToken(token);
      token = localStorage.getItem("token");
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 means the session is over:
//   - a demo visitor (timer ran out, exited in another tab): the demo ends,
//   - a signed-in user (signed out on another device, password changed, account disabled,
//     token expired): the app signs out and shows the server's message on the sign-in page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthCall(error.config?.url)) {
      if (error.response.data?.code === "demo_expired" || isDemoVisitor()) {
        window.dispatchEvent(new Event(DEMO_ENDED_EVENT));
      } else if (localStorage.getItem("token")) {
        window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, {
          detail: { message: error.response.data?.message || "Your session has expired. Please sign in again." },
        }));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
