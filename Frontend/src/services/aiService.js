import api from "./api";

export const aiService = {
  // Admin on/off switches for the two assistants.
  getSettings: async () => (await api.get("/ai/settings")).data,
  updateSettings: async (dto) => (await api.put("/ai/settings", dto)).data,
  // Public (no sign-in): whether the website chat bubble should show.
  publicStatus: async () => (await api.get("/ai/public-status")).data,
};
