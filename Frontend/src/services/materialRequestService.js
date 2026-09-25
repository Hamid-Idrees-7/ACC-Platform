import api from "./api";

// Admin/store side — reviewing and resolving field material requests.
export const materialRequestService = {
  getAll: async () => {
    const response = await api.get("/materialrequests");
    return response.data;
  },

  getPendingCount: async () => {
    const response = await api.get("/materialrequests/pending-count");
    return response.data.count;
  },

  approve: async (id) => {
    const response = await api.post(`/materialrequests/${id}/approve`);
    return response.data;
  },

  reject: async (id, note) => {
    const response = await api.post(`/materialrequests/${id}/reject`, { note: note || null });
    return response.data;
  },
};
