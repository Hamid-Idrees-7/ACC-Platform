import api from "./api";

export const clientService = {
  getAll: async () => {
    const response = await api.get("/clients");
    return response.data;
  },

  create: async (data) => {
    const response = await api.post("/clients", data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/clients/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },
};
