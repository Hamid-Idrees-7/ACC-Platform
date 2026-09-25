import api from "./api";

export const fieldService = {
  // The logged-in engineer's own sites + todays attendance snapshot
  getMySite: async () => {
    const response = await api.get("/field/my-site");
    return response.data;
  },

  // Attendance sheet for one of my sites on a date
  getSheet: async (projectId, date) => {
    const response = await api.get(`/field/sheet/${projectId}`, { params: { date } });
    return response.data;
  },

  // Mark attendance for one of my sites.
  // dto: { date, entries: [{ assignmentID, status, note }] }
  markAttendance: async (projectId, dto) => {
    const response = await api.post(`/field/attendance/${projectId}`, dto);
    return response.data;
  },

  // Phases of one of my sites (for progress updates)
  getPhases: async (projectId) => {
    const response = await api.get(`/field/phases/${projectId}`);
    return response.data;
  },

  // Update one phase's progress on my site. Returns the refreshed phase list
  updateProgress: async (projectId, phaseID, progress) => {
    const response = await api.post(`/field/progress/${projectId}`, { phaseID, progress });
    return response.data;
  },

  // Materials + phases to build a material request for my site.
  getRequestOptions: async (projectId) => {
    const response = await api.get(`/field/request-options/${projectId}`);
    return response.data;
  },

  // Raise a material request. dto: { materialID, phaseID, quantity, note }
  createRequest: async (projectId, dto) => {
    const response = await api.post(`/field/material-request/${projectId}`, dto);
    return response.data;
  },

  // My own material requests + their status
  getMyRequests: async () => {
    const response = await api.get("/field/my-requests");
    return response.data;
  },

  // Non-financial details of my site (budget etc are never sent to the field)
  getSiteInfo: async (projectId) => {
    const response = await api.get(`/field/site-info/${projectId}`);
    return response.data;
  },

  // Cancel my own still-pending request
  deleteRequest: async (requestId) => {
    const response = await api.delete(`/field/material-request/${requestId}`);
    return response.data;
  },
};
