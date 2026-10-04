import api from "./api";

export const notificationService = {
  // type: Personal or Activity
  getMine: async (type = "Personal") => {
    const response = await api.get(`/notifications?type=${type}`);
    return response.data;
  },

  getUnreadCounts: async () => {
    const response = await api.get("/notifications/unread-count");
    return { count: response.data.count ?? 0, alerts: response.data.alerts ?? 0 };
  },

  // Mark all of a type as read
  markAllRead: async (type = "Personal", upTo = null) => {
    const response = await api.put(`/notifications/read-all?type=${type}${upTo ? `&upTo=${upTo}` : ""}`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  deleteAll: async (type = "Personal") => {
    const response = await api.delete(`/notifications?type=${type}`);
    return response.data;
  },
};
