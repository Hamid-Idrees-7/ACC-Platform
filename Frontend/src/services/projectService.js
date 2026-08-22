import api from "./api";

export const projectService = {
  getAll: async () => {
    const response = await api.get("/projects");
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post("/projects", data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },

  changeStatus: async (id, status) => {
    const response = await api.put(`/projects/${id}/status`, { status });
    return response.data;
  },

  // Phases
  addPhase: async (id, name) => {
    const response = await api.post(`/projects/${id}/phases`, { name });
    return response.data;
  },

  updatePhase: async (phaseId, data) => {
    const response = await api.put(`/projects/phases/${phaseId}`, data);
    return response.data;
  },

  deletePhase: async (phaseId) => {
    const response = await api.delete(`/projects/phases/${phaseId}`);
    return response.data;
  },

  reorderPhases: async (id, phaseIDs) => {
    const response = await api.put(`/projects/${id}/phases/reorder`, { phaseIDs });
    return response.data;
  },
};
