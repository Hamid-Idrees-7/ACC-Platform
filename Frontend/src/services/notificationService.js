import api from "./api";

export const notificationService = {
  // Get my notifications by type (Personal or Activity)
  getMine: async (type = "Personal") => {
    const response = await api.get(`/notifications?type=${type}`);
    return response.data;
  },

  // Unread personal count (bell badge)
  getUnreadCount: async () => {
    const response = await api.get("/notifications/unread-count");
    return response.data.count;
  },

  // Mark one as read
  markRead: async (id) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },

  // Mark all of a type as read
  markAllRead: async (type = "Personal") => {
    const response = await api.put(`/notifications/read-all?type=${type}`);
    return response.data;
  },

  // Delete one
  delete: async (id) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  // Delete all of a type
  deleteAll: async (type = "Personal") => {
    const response = await api.delete(`/notifications?type=${type}`);
    return response.data;
  },
};
