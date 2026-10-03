import axios from "axios";
import { DEMO_ENDED_EVENT } from "../config/demoConfig";
import { SESSION_ENDED_EVENT, RENEW_BEFORE_MS } from "../config/sessionConfig";
import { tokenExpiresAt } from "../utils/token";
import { API_BASE_URL, SERVER_UNREACHABLE_EVENT } from "../config/apiConfig";

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

// Sign-in, sign-out, renewal and password reset never renew the token or trigger the
// signed-out handling.
const isAuthCall = (url) => /\/auth\/(login|logout|refresh|forgot-password|reset-password(\/check)?)$/.test(url || "");

// Renews the token of the current session while the user keeps working. Only one renewal
// runs at a time; every request waiting for it then uses the new token.
// Near the session's hard limit (12 hours, or 30 days with Remember me) the server can't
// renew any more; that token is then not tried again, so requests don't each wait on it.
let renewing = null;
let notRenewable = null;
const renewToken = (token) => {
  if (!renewing) {
    renewing = axios
      .post(`${API_BASE_URL}/auth/refresh`, null, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        // Only if nobody signed in or out in the meantime.
        if (res.data?.token && localStorage.getItem("token") === token) {
          localStorage.setItem("token", res.data.token);
        }
      })
      .catch((err) => {
        // Refused by the server (not just offline): don't ask again for this token.
        // The request itself gets a 401 if the session is really over.
        if (err.response) notRenewable = token;
      })
      .finally(() => {
        renewing = null;
      });
  }
  return renewing;
};

// Attach the JWT to every request when the user is signed in. A token that
// expires within 30 minutes is renewed first.
api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem("token");
  if (token && !isAuthCall(config.url) && !isDemoVisitor()) {
    const expiresAt = tokenExpiresAt(token);
    const left = expiresAt ? expiresAt - Date.now() : null;
    if (left !== null && left > 0 && left < RENEW_BEFORE_MS && token !== notRenewable) {
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
    if (!error.response && error.code !== "ERR_CANCELED") {
      window.dispatchEvent(new Event(SERVER_UNREACHABLE_EVENT));
    }
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
