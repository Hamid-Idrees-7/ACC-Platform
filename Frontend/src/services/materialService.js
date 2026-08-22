import api from "./api";

export const materialService = {
  getAll: async () => {
    const response = await api.get("/materials");
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/materials/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post("/materials", data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/materials/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/materials/${id}`);
    return response.data;
  },

  // Stock in
  restock: async (id, data) => {
    const response = await api.post(`/materials/${id}/restock`, data);
    return response.data;
  },

  // Stock out to a project
  issue: async (id, data) => {
    const response = await api.post(`/materials/${id}/issue`, data);
    return response.data;
  },

  // Full transaction ledger + summary for one material
  getHistory: async (id) => {
    const response = await api.get(`/materials/${id}/history`);
    return response.data;
  },

  // Reverse a transaction (returns/removes stock; record kept as cancelled)
  cancelTransaction: async (txId) => {
    const response = await api.post(`/materials/transactions/${txId}/cancel`);
    return response.data;
  },
};
