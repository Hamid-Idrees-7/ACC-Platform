import api from "./api";

export const employeeService = {
  getAll: async () => {
    const response = await api.get("/employees");
    return response.data;
  },

  create: async (data) => {
    const response = await api.post("/employees", data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/employees/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
  },
};
