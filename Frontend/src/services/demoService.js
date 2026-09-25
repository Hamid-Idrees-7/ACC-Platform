import api from "./api";

// Live demo: every visitor gets a private copy of the demo company.
export const demoService = {
  // Is the demo switched on, and is a seat free right now?
  getStatus: async () => {
    const response = await api.get("/demo/status");
    return response.data;
  },

  // Login as Visitor. role: admin | "manager" | "engineer"
  start: async (role) => {
    const response = await api.post("/demo/start", { role });
    return response.data;
  },

  // Switch role inside the same demo (same data, same timer).
  switchRole: async (role) => {
    const response = await api.post("/demo/switch", { role });
    return response.data;
  },

  // See the system as another user in this demo (one the visitor created).
  viewAs: async (userId) => {
    const response = await api.post(`/demo/view-as/${userId}`);
    return response.data;
  },

  // Exit the demo: frees the seat and deletes the visitor's data straight away.
  end: async () => {
    const response = await api.post("/demo/end");
    return response.data;
  },
};
