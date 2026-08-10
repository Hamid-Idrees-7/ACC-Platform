import api from "./api";

export const clientService = {
  // Get all clients
  getAll: async () => {
    const response = await api.get("/clients");
    return response.data;
  },

  // Get one client by ID
  getById: async (id) => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  // Create a new client
  create: async (data) => {
    const response = await api.post("/clients", data);
    return response.data;
  },

  // Update a client
  update: async (id, data) => {
    const response = await api.put(`/clients/${id}`, data);
    return response.data;
  },

  // Delete a client
  delete: async (id) => {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },
};
