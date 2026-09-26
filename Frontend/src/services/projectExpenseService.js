import api from "./api";

// Project expenses: plot fees, transfer fees, taxes, possession charges and other one-off costs
export const projectExpenseService = {
  // All expenses of a project with server-computed totals, categories and phases
  getForProject: async (projectId) => {
    const response = await api.get(`/expenses/project/${projectId}`);
    return response.data;
  },

  // data: { category, description, amount, expenseDate, phaseID, paidTo, reference, isRecoverable }
  create: async (projectId, data) => {
    const response = await api.post(`/expenses/project/${projectId}`, data);
    return response.data;
  },

  update: async (expenseId, data) => {
    const response = await api.put(`/expenses/${expenseId}`, data);
    return response.data;
  },

  // May return { requiresApproval: true, message } instead of deleting straight away
  delete: async (expenseId) => {
    const response = await api.delete(`/expenses/${expenseId}`);
    return response.data;
  },
};
