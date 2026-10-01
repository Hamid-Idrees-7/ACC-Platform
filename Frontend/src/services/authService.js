import api from "./api";

export const authService = {
  login: async (username, password, keepSignedIn) => {
    const response = await api.post("/auth/login", { username, password, keepSignedIn });
    return response.data;
  },

  // Emails a reset link. The answer is the same whether the account exists or not.
  forgotPassword: async (login) => {
    const response = await api.post("/auth/forgot-password", { login });
    return response.data;
  },

  // Returns { username } while the link still works.
  checkResetCode: async (code) => {
    const response = await api.post("/auth/reset-password/check", { code });
    return response.data;
  },

  resetPassword: async (code, newPassword) => {
    const response = await api.post("/auth/reset-password", { code, newPassword });
    return response.data;
  },
};
