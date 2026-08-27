import api from "./api";

export const salaryService = {
  // One month of payroll (stats + employee cards)
  getPeriod: async (year, month, projectId) => {
    const response = await api.get("/salaries", { params: { year, month, projectId: projectId || undefined } });
    return response.data;
  },

  pay: async (data) => {
    const response = await api.post("/salaries/pay", data);
    return response.data;
  },

  // Undo a payment (back to Pending)
  revert: async (paymentId) => {
    const response = await api.delete(`/salaries/${paymentId}`);
    return response.data;
  },

  // Printable payslip for an employee + month
  getPayslip: async (employeeId, year, month) => {
    const response = await api.get(`/salaries/${employeeId}/payslip`, { params: { year, month } });
    return response.data;
  },
};
