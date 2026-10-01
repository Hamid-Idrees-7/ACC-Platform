import api from "./api";

export const billingService = {
  // List page: overview stats and a card per project.
  getOverview: async () => {
    const response = await api.get("/billing");
    return response.data;
  },

  // Detail page for one project (invoices and phase options).
  getProject: async (projectId) => {
    const response = await api.get(`/billing/project/${projectId}`);
    return response.data;
  },

  // data: { projectID, issueDate, dueDate, taxAmount, notes, items: [{ description, quantity, rate, phaseID }] }
  createInvoice: async (data) => {
    const response = await api.post("/billing/invoices", data);
    return response.data;
  },

  // Edit an existing invoice (same shape as create).
  updateInvoice: async (invoiceId, data) => {
    const response = await api.put(`/billing/invoices/${invoiceId}`, data);
    return response.data;
  },

  deleteInvoice: async (invoiceId) => {
    const response = await api.delete(`/billing/invoices/${invoiceId}`);
    return response.data;
  },

  // A payment can be partial.
  // data: { invoiceID, amount, paymentDate, method, reference }
  recordPayment: async (data) => {
    const response = await api.post("/billing/payments", data);
    return response.data;
  },

  deletePayment: async (paymentId) => {
    const response = await api.delete(`/billing/payments/${paymentId}`);
    return response.data;
  },

  // Invoice data for the print page
  getInvoicePrint: async (invoiceId) => {
    const response = await api.get(`/billing/invoices/${invoiceId}/print`);
    return response.data;
  },
};
