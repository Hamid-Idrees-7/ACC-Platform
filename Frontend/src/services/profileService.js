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
};
