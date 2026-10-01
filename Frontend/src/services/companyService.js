import api from "./api";

export const companyService = {
  // Company details, currency and defaults (Settings > Company)
  get: async () => {
    const response = await api.get("/company");
    return response.data;
  },

  // Admin only
  save: async (data) => {
    const response = await api.put("/company", data);
    return response.data;
  },
};
