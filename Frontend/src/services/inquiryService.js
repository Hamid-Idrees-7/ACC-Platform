import api from "./api";

export const inquiryService = {
  // Get all inquiries (dashboard)
  getAll: async () => {
    const response = await api.get("/inquiries");
    return response.data;
  },

  // Get unread count (for the badge)
  getUnreadCount: async () => {
    const response = await api.get("/inquiries/unread-count");
    return response.data.count;
  },

  // Mark one as read
  markAsRead: async (id) => {
    const response = await api.put(`/inquiries/${id}/read`);
    return response.data;
  },

  // Delete one
  delete: async (id) => {
    const response = await api.delete(`/inquiries/${id}`);
    return response.data;
  },

  // Delete all
  deleteAll: async () => {
    const response = await api.delete("/inquiries");
    return response.data;
  },
};