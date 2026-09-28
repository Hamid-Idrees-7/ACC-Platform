import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { LIVE_HUB_URL } from "../config/apiConfig";

const RETRY_MS = [0, 2000, 5000, 10000, 20000, 30000];

const bus = new EventTarget();
let connection = null;
let identity = null;
let restartTimer = null;
let restartAttempt = 0;

const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));

const retryDelay = (attempt) => RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)];

const scheduleRestart = (conn) => {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (connection !== conn) return;
    conn.start()
      .then(() => {
        restartAttempt = 0;
        emit("status", true);
        emit("resync");
      })
      .catch(() => {
        restartAttempt += 1;
        scheduleRestart(conn);
      });
  }, retryDelay(restartAttempt + 1));
};

export function startLive(who) {
  if (connection && identity === who) return;
  stopLive();
  identity = who;

  const conn = new HubConnectionBuilder()
    .withUrl(LIVE_HUB_URL, {
      accessTokenFactory: () => localStorage.getItem("token") || "",
      withCredentials: false,
    })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => retryDelay(ctx.previousRetryCount) })
    .configureLogging(LogLevel.None)
    .build();

  conn.on("data", (payload) => emit("data", payload));
  conn.on("notifications", (payload) => emit("notifications", payload));
  conn.onreconnecting(() => emit("status", false));
  conn.onreconnected(() => {
    emit("status", true);
    emit("resync");
  });
  conn.onclose(() => {
    emit("status", false);
    if (connection === conn) scheduleRestart(conn);
  });

  connection = conn;
  restartAttempt = 0;
  conn.start()
    .then(() => emit("status", true))
    .catch(() => {
      if (connection === conn) scheduleRestart(conn);
    });
}

export function stopLive() {
  clearTimeout(restartTimer);
  const conn = connection;
  connection = null;
  identity = null;
  if (conn) {
    conn.stop().catch(() => {});
    emit("status", false);
  }
}

export const isLiveConnected = () => connection?.state === HubConnectionState.Connected;

export function onLive(name, handler) {
  const listener = (event) => handler(event.detail);
  bus.addEventListener(name, listener);
  return () => bus.removeEventListener(name, listener);
}
