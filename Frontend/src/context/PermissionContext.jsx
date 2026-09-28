import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { permissionService } from "../services/permissionService";
import { useLiveRefresh } from "../hooks/useLive";

const PermissionContext = createContext();

export function PermissionProvider({ children }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadedFor = useRef(null);

  const isAdmin = user?.role?.toLowerCase() === "admin";

  const loadPermissions = useCallback(async ({ quiet = false } = {}) => {
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
    if (!quiet) setLoading(true);
    const myId = user.userID ?? user.userId ?? user.id;
    // When a different person signs in (e.g. a demo role switch), never show the previous
    // person's access while the new permissions load. A simple reload keeps them visible.
    const identity = `${myId}:${user.username}`;
    if (loadedFor.current !== identity) setPermissions([]);
    try {
      const data = await permissionService.getForUser(myId);
      setPermissions(Array.isArray(data) ? data : []);
      loadedFor.current = identity;
    } catch {
      if (!quiet) setPermissions([]);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  useLiveRefresh(["permissions", "users"], () => loadPermissions({ quiet: true }));

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
