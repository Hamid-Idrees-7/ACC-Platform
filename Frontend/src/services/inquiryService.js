import api from "./api";

export const inquiryService = {
  getAll: async () => {
    const response = await api.get("/inquiries");
    return response.data;
  },

  markAsRead: async (id) => {
    const response = await api.put(`/inquiries/${id}/read`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/inquiries/${id}`);
    return response.data;
  },

  deleteAll: async () => {
    const response = await api.delete("/inquiries");
    return response.data;
  },
};