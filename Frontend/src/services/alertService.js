import api from "./api";

export const alertService = {
  getAll: async (status = "Open") => {
    const response = await api.get(`/alerts?status=${status}`);
    return response.data;
  },

  getSummary: async () => {
    const response = await api.get("/alerts/summary");
    return response.data;
  },

  resolve: async (id) => {
    const response = await api.put(`/alerts/${id}/resolve`);
    return response.data;
  },

  checkNow: async () => {
    const response = await api.post("/alerts/check");
    return response.data;
  },

  getRules: async () => {
    const response = await api.get("/alerts/rules");
    return response.data;
  },

  saveRule: async (type, rule) => {
    const response = await api.put(`/alerts/rules/${type}`, rule);
    return response.data;
  },
};
