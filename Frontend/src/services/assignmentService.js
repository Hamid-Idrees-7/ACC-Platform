import api from "./api";

export const assignmentService = {
  getAll: async () => {
    const response = await api.get("/assignments");
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/assignments/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post("/assignments", data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/assignments/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/assignments/${id}`);
    return response.data;
  },

  // Mark Completed with today's date
  end: async (id) => {
    const response = await api.put(`/assignments/${id}/end`);
    return response.data;
  },
};
