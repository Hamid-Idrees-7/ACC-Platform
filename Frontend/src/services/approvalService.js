import api from "./api";

export const approvalService = {
  // All requests (Admin)
  getAll: async () => {
    const response = await api.get("/approvals");
    return response.data;
  },

  // Pending count (for the dashboard card)
  getCount: async () => {
    const response = await api.get("/approvals/count");
    return response.data.count;
  },

  // Approve or reject a request
  resolve: async (id, status, reason) => {
    const response = await api.put(`/approvals/${id}/resolve`, { status, reason });
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/approvals/${id}`);
    return response.data;
  },

  deleteAll: async () => {
    const response = await api.delete("/approvals");
    return response.data;
  },
};
