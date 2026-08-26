import api from "./api";

export const attendanceService = {
  // Project cards for the list page
  getCards: async () => {
    const response = await api.get("/attendance");
    return response.data;
  },

  // The mark-attendance sheet for a project on a given date (ISO YYYY-MM-DD)
  getSheet: async (projectId, date) => {
    const response = await api.get(`/attendance/${projectId}`, { params: { date } });
    return response.data;
  },

  // Save marked rows for a date. entries: [{ assignmentID, status, note }]
  save: async (projectId, date, entries) => {
    const response = await api.post(`/attendance/${projectId}`, { date, entries });
    return response.data;
  },
};
