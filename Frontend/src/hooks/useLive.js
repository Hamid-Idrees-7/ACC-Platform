import { useEffect, useRef, useState } from "react";
import { onLive, isLiveConnected } from "../services/live";

export function useLiveRefresh(modules, refresh, { delay = 350, paused = false } = {}) {
  const refreshRef = useRef(refresh);
  const pausedRef = useRef(paused);
  const missed = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
    pausedRef.current = paused;
  });

  const key = modules.join(",");

  useEffect(() => {
    const wanted = key.split(",");
    let timer = null;
    const schedule = () => {
      if (pausedRef.current) {
        missed.current = true;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => refreshRef.current?.(), delay);
    };
    const offData = onLive("data", (payload) => {
      if (payload?.modules?.some((m) => wanted.includes(m))) schedule();
    });
    const offSync = onLive("resync", schedule);
    return () => {
      clearTimeout(timer);
      offData();
      offSync();
    };
  }, [key, delay]);

  useEffect(() => {
    if (!paused && missed.current) {
      missed.current = false;
      refreshRef.current?.();
    }
  }, [paused]);
}

export function useLiveNotifications(handler) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    const offNotes = onLive("notifications", (payload) => handlerRef.current?.(payload || {}));
    const offSync = onLive("resync", () => handlerRef.current?.({ resync: true }));
    return () => {
      offNotes();
      offSync();
    };
  }, []);
}

export function useLiveConnected() {
  const [connected, setConnected] = useState(isLiveConnected);
  useEffect(() => onLive("status", (value) => setConnected(!!value)), []);
  return connected;
}
