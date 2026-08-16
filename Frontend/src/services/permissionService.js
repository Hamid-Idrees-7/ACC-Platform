import api from "./api";

export const permissionService = {
  // Get all permissions for a specific user
  getForUser: async (userId) => {
    const response = await api.get(`/permissions/user/${userId}`);
    return response.data;
  },

  // Get module counts for all users (for the "X of N modules" cards)
  getCounts: async () => {
    const response = await api.get("/permissions/counts");
    return response.data;
  },

  // Set (toggle) one permission
  set: async (data) => {
    const response = await api.put("/permissions", data);
    return response.data;
  },
};
