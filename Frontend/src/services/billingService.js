import api from "./api";

export const billingService = {
  // List page: overview stats + a card per project.
  getOverview: async () => {
    const response = await api.get("/billing");
    return response.data;
  },

  // Detail page for one project (invoices + phase options).
  getProject: async (projectId) => {
    const response = await api.get(`/billing/project/${projectId}`);
    return response.data;
  },

  // Create an invoice
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

  // Record a (partial) payment
  // data: { invoiceID, amount, paymentDate, method, reference }
  recordPayment: async (data) => {
    const response = await api.post("/billing/payments", data);
    return response.data;
  },

  deletePayment: async (paymentId) => {
    const response = await api.delete(`/billing/payments/${paymentId}`);
    return response.data;
  },

  // Printable invoice payload
  getInvoicePrint: async (invoiceId) => {
    const response = await api.get(`/billing/invoices/${invoiceId}/print`);
    return response.data;
  },
};
