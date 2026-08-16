import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { permissionService } from "../services/permissionService";

const PermissionContext = createContext();

export function PermissionProvider({ children }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role?.toLowerCase() === "admin";

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }
    if (user.role?.toLowerCase() === "admin") {
      setPermissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const myId = user.userID ?? user.userId ?? user.id;
      const data = await permissionService.getForUser(myId);
      // Debug: see what permissions loaded (remove later)
      console.log("[Permissions] loaded for user", myId, data);
      setPermissions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[Permissions] load failed", err);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const can = useCallback((module, action) => {
    if (isAdmin) return true;
    const p = permissions.find((x) => x.module === module && x.action === action);
    return !!p && p.isAllowed;
  }, [isAdmin, permissions]);

  const needsApproval = useCallback((module, action) => {
    if (isAdmin) return false;
    const p = permissions.find((x) => x.module === module && x.action === action);
    return !!p && p.isAllowed && p.requiresApproval;
  }, [isAdmin, permissions]);

  const canView = useCallback((module) => can(module, "View"), [can]);

  return (
    <PermissionContext.Provider value={{ permissions, loading, isAdmin, can, canView, needsApproval, reloadPermissions: loadPermissions }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}
