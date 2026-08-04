import { createContext, useContext, useState, useEffect } from "react";

// Create the context (the shared "notice board")
const AuthContext = createContext();

// Provider component - wraps the app and gives login state to all pages
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
    localStorage.setItem(
      "user",
      JSON.stringify({
        userID: authData.userID,
        username: authData.username,
        fullName: authData.fullName,
        role: authData.role,
      })
    );
    setUser({
      userID: authData.userID,
      username: authData.username,
      fullName: authData.fullName,
      role: authData.role,
    });
  };

  // Called on logout - clear everything
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook - lets any page easily use the auth context
export function useAuth() {
  return useContext(AuthContext);
}