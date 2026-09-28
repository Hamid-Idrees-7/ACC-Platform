import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { startLive, stopLive } from "../services/live";

function LiveConnection() {
  const { user } = useAuth();
  const who = user ? `${user.userID}:${user.username}:${user.demo?.role || ""}` : null;

  useEffect(() => {
    if (who) startLive(who);
    else stopLive();
  }, [who]);

  useEffect(() => () => stopLive(), []);

  return null;
}

export default LiveConnection;
