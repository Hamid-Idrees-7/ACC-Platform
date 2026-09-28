export const NOTIFICATION_GROUPS = [
  {
    key: "account",
    title: "Account",
    items: [
      { category: "Login", label: "Sign-ins", hint: "A \"Welcome back\" note each time you sign in." },
      { category: "Security", label: "Security alerts", hint: "Sign-in paused after wrong passwords, and other warnings.", locked: true },
    ],
  },
  {
    key: "requests",
    title: "Requests and approvals",
    items: [
      { category: "Approval", label: "Approvals", hint: "Requests you send, their result, and new requests you can approve." },
      { category: "Material Requests", label: "Material requests", hint: "Site material requests, their result, and new ones you can approve." },
      { category: "Message", label: "Website messages", hint: "A new message from the contact form on the website.", module: "Messages" },
    ],
  },
  {
    key: "changes",
    title: "Your own changes",
    hint: "A confirmation when you add, change or delete something.",
    items: [
      { category: "Client", label: "Clients", module: "Clients" },
      { category: "Employee", label: "Employees", module: "Employees" },
      { category: "Project", label: "Projects", module: "Projects" },
      { category: "Assignment", label: "Assignments", module: "Assignments" },
      { category: "Material", label: "Materials", module: "Materials" },
      { category: "Expense", label: "Project expenses", module: "Expenses" },
      { category: "Billing", label: "Invoices and payments", module: "Billing" },
      { category: "Salary", label: "Salaries", module: "Salaries" },
    ],
  },
];

export const NOTIFICATION_POLL_MS = 30 * 1000;

export const ALERT_BASELINE_KEY = "acc-alerts-seen";
