import { createContext, useContext, useState, useEffect, useCallback } from "react";

// Create the context (the shared "notice board")
const AuthContext = createContext();

// Demo role transition timing: the role card stays up at least this long,
// then fades out while the new dashboard fades in (1.5s in total).
const TRANSITION_MIN_MS = 700;                                                       // card kitni der dikhe
const TRANSITION_OUT_MS = 300;                                                       // card kitni der me gayab ho

// Provider component - wraps the app and gives login state to all pages
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Live demo role-change transition: { role, title, phase: in | out } or null
  const [demoTransition, setDemoTransition] = useState(null);

  // On app load, check if a user is already logged in (from localStorage)
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Called after a successful login - save token and user info
  const login = (authData) => {
    localStorage.setItem("token", authData.token);
    const userInfo = {
      userID: authData.userID,
      username: authData.username,
      fullName: authData.fullName,
      role: authData.role,
      profilePicture: authData.profilePicture || null,
      // Demo visitors carry their demo role and the moment their session ends.
      demo: authData.isDemo
        ? {
            role: authData.demoRole,
            label: authData.demoRoleLabel || null,
            endsAt: Date.now() + (authData.demoSecondsLeft || 0) * 1000,
          }
        : null,
    };
    localStorage.setItem("user", JSON.stringify(userInfo));
    setUser(userInfo);
  };

  // Update user info only (keeps the token untouched)
  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem("user", JSON.stringify(merged));
      return merged;
    });
  };

  // Called on logout - clear everything
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };


  const runDemoTransition = useCallback(async (role, title, action, label = null) => {
    setDemoTransition({ role, title, label, phase: "in" });
    try {
      const [result] = await Promise.all([
        action(),
        new Promise((resolve) => setTimeout(resolve, TRANSITION_MIN_MS)),
      ]);
      return result;
    } finally {
      setDemoTransition((current) => (current ? { ...current, phase: "out" } : current));
      setTimeout(() => setDemoTransition(null), TRANSITION_OUT_MS);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, updateUser, loading, demoTransition, runDemoTransition }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook - lets any page easily use the auth context
export function useAuth() {
  return useContext(AuthContext);
}
