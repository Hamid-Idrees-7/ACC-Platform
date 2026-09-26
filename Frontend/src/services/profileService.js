import api from "./api";

export const profileService = {
  // Get my profile
  get: async () => {
    const response = await api.get("/profile");
    return response.data;
  },

  // Update my profile info
  update: async (data) => {
    const response = await api.put("/profile", data);
    return response.data;
  },

  // Update profile picture (Base64 string, or null to remove)
  updatePicture: async (profilePicture) => {
    const response = await api.put("/profile/picture", { profilePicture });
    return response.data;
  },

  // Change my password
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put("/profile/password", { currentPassword, newPassword });
    return response.data;
  },

  // Change my username (requires current password for re-authentication)
  changeUsername: async (currentPassword, newUsername) => {
    const response = await api.put("/profile/username", { currentPassword, newUsername });
    return response.data;
  },

  // Verify the current password (for sensitive-action re-authentication)
  verifyPassword: async (password) => {
    const response = await api.post("/profile/verify-password", { password });
    return response.data;
  },

  // My display settings: { theme, numberFormat, dateFormat, timeFormat }
  getPreferences: async () => {
    const response = await api.get("/profile/preferences");
    return response.data;
  },

  savePreferences: async (prefs) => {
    const response = await api.put("/profile/preferences", prefs);
    return response.data;
  },
};