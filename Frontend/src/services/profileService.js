import api from "./api";

export const profileService = {
  get: async () => {
    const response = await api.get("/profile");
    return response.data;
  },

  update: async (data) => {
    const response = await api.put("/profile", data);
    return response.data;
  },

  // Base64 string, or null to remove the picture
  updatePicture: async (profilePicture) => {
    const response = await api.put("/profile/picture", { profilePicture });
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put("/profile/password", { currentPassword, newPassword });
    return response.data;
  },

  // Needs the current password again
  changeUsername: async (currentPassword, newUsername) => {
    const response = await api.put("/profile/username", { currentPassword, newUsername });
    return response.data;
  },

  // Checks the current password before a sensitive action
  verifyPassword: async (password) => {
    const response = await api.post("/profile/verify-password", { password });
    return response.data;
  },

  // My signed-in devices and sign-in history (Settings > Security)
  getSecurity: async () => {
    const response = await api.get("/profile/security");
    return response.data;
  },

  // Sign out one of my other devices
  signOutSession: async (id) => {
    const response = await api.post(`/profile/sessions/${id}/sign-out`);
    return response.data;
  },

  // Sign out of every device except this one
  signOutOtherSessions: async () => {
    const response = await api.post("/profile/sessions/sign-out-others");
    return response.data;
  },

  // My display settings: { theme, numberFormat, dateFormat, timeFormat, idleMinutes }
  getPreferences: async () => {
    const response = await api.get("/profile/preferences");
    return response.data;
  },

  savePreferences: async (prefs) => {
    const response = await api.put("/profile/preferences", prefs);
    return response.data;
  },
};