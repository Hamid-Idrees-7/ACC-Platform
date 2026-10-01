import { LIVE_HUB_URL } from "../config/apiConfig";

const RETRY_MS = [0, 2000, 5000, 10000, 20000, 30000];

const bus = new EventTarget();
let connection = null;
let identity = null;
let restartTimer = null;
let restartAttempt = 0;
let generation = 0;

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
  if (identity === who) return;
  stopLive();
  identity = who;
  const ticket = generation;

  import("@microsoft/signalr")
    .then((signalr) => {
      if (ticket === generation) connect(signalr);
    })
    .catch(() => {});
}

function connect({ HubConnectionBuilder, LogLevel }) {
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
  generation += 1;
  clearTimeout(restartTimer);
  const conn = connection;
  connection = null;
  identity = null;
  if (conn) {
    conn.stop().catch(() => {});
    emit("status", false);
  }
}

export const isLiveConnected = () => connection?.state === "Connected";

// The server is reachable again: reload every open page now and reconnect right away,
// instead of waiting for the next retry (up to 30 seconds).
export function resyncNow() {
  emit("resync");
  if (identity && connection?.state !== "Connected") {
    const who = identity;
    stopLive();
    startLive(who);
  }
}

export function onLive(name, handler) {
  const listener = (event) => handler(event.detail);
  bus.addEventListener(name, listener);
  return () => bus.removeEventListener(name, listener);
}
