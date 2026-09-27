import api from "./api";

export const calendarService = {
  // Weekly off days and holidays (Settings > Calendar)
  get: async () => {
    const response = await api.get("/calendar");
    return response.data;
  },

  // The rest is Admin only; each returns the whole calendar again.
  saveWeeklyOff: async (days) => {
    const response = await api.put("/calendar/weekly-off", { days });
    return response.data;
  },

  addHoliday: async (holiday) => {
    const response = await api.post("/calendar/holidays", holiday);
    return response.data;
  },

  updateHoliday: async (id, holiday) => {
    const response = await api.put(`/calendar/holidays/${id}`, holiday);
    return response.data;
  },

  deleteHoliday: async (id) => {
    const response = await api.delete(`/calendar/holidays/${id}`);
    return response.data;
  },
};
