import api from "./api";

export const userService = {
  getAll: async () => {
    const response = await api.get("/users");
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post("/users", data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  // Sets the user active or disabled (the wanted state is sent, so a repeat does nothing)
  toggleStatus: async (id, active) => {
    const response = await api.put(`/users/${id}/toggle-status`, null, { params: { active } });
    return response.data;
  },

  // Signed-in devices and sign-in history of a user
  getSecurity: async (id) => {
    const response = await api.get(`/users/${id}/security`);
    return response.data;
  },

  // Sign a user out of every device
  signOutEverywhere: async (id) => {
    const response = await api.post(`/users/${id}/sign-out`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};
