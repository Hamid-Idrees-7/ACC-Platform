import api from "./api";

export const userService = {
  // Get all users
  getAll: async () => {
    const response = await api.get("/users");
    return response.data;
  },

  // Get one user by ID
  getById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  // Create a new user
  create: async (data) => {
    const response = await api.post("/users", data);
    return response.data;
  },

  // Update a user
  update: async (id, data) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  // Enable/disable a user (toggle active status)
  toggleStatus: async (id) => {
    const response = await api.put(`/users/${id}/toggle-status`);
    return response.data;
  },

  // Delete a user
  delete: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};
