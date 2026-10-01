import api from "./api";

export const permissionService = {
  getForUser: async (userId) => {
    const response = await api.get(`/permissions/user/${userId}`);
    return response.data;
  },

  // Module counts per user, for the "X of N modules" cards
  getCounts: async () => {
    const response = await api.get("/permissions/counts");
    return response.data;
  },

  // Turns one permission on or off
  set: async (data) => {
    const response = await api.put("/permissions", data);
    return response.data;
  },
};
