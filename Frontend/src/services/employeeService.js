import api from "./api";

export const employeeService = {
  // Get all employees
  getAll: async () => {
    const response = await api.get("/employees");
    return response.data;
  },

  // Get one employee by ID
  getById: async (id) => {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  },

  // Create a new employee
  create: async (data) => {
    const response = await api.post("/employees", data);
    return response.data;
  },

  // Update an employee
  update: async (id, data) => {
    const response = await api.put(`/employees/${id}`, data);
    return response.data;
  },

  // Delete an employee
  delete: async (id) => {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
  },
};
