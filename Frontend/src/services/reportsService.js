import api from "./api";

export const reportsService = {
  // The full company report (financial, projects, materials, workforce).
  getReports: async () => {
    const response = await api.get("/reports");
    return response.data;
  },
};
