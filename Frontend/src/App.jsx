import { Fragment } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import { PermissionProvider } from "./context/PermissionContext";
import DemoTransition from "./components/DemoTransition";

// Public pages
import Home from "./pages/Home";
import About from "./pages/About";
import Projects from "./pages/Projects";
import Privacy from "./pages/Privacy";
import Login from "./pages/Login";


// Dashboard pages
import Dashboard from "./pages/Dashboard";
import Queries from "./pages/Queries";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import ControlUnit from "./pages/ControlUnit";
import ManageAccess from "./pages/ManageAccess";
import Approvals from "./pages/Approvals";
import Notifications from "./pages/Notifications";


// Modules
import Clients from "./pages/Clients";
import Employees from "./pages/Employees";
import Users from "./pages/Users";
import Materials from "./pages/Materials";
import MaterialHistory from "./pages/MaterialHistory";
import ProjectManagement from "./pages/ProjectManagement";
import ProjectDetail from "./pages/ProjectDetail";
import Assignments from "./pages/Assignments";
import Attendance from "./pages/Attendance";
import MarkAttendance from "./pages/MarkAttendance";
import Salaries from "./pages/Salaries";
import Payslip from "./pages/Payslip";
import Billing from "./pages/Billing";
import ProjectBilling from "./pages/ProjectBilling";
import InvoicePrint from "./pages/InvoicePrint";
import Reports from "./pages/Reports";
import FieldView from "./pages/FieldView";
import MaterialRequests from "./pages/MaterialRequests";

import UnderConstruction from "./pages/UnderConstruction";

// Remounts the dashboard pages whenever the signed-in person changes (eg a live demo role
// switch), so every page and the notification bell reload their data for the new user
// instead of keeping what the previous user saw.
function SignedInBoundary() {
  const { user, loading } = useAuth();

  // Wait for the saved sign-in to be read, so pages mount once (not first as a guest).
  if (loading) return null;

  const identity = user ? `${user.userID}:${user.username}` : "guest";
  return (
    <Fragment key={identity}>
      <Outlet />
    </Fragment>
  );
}

function App() {
  return (
    <AuthProvider>
      <PermissionProvider>
      {/* Live demo role-change card: lives above the routes so it survives page changes */}
      <DemoTransition />
      <BrowserRouter>
        <Routes>
          {/* ===== Public website ===== */}
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/login" element={<Login />} />

          <Route element={<SignedInBoundary />}>
            {/* ===== Dashboard ===== */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/queries" element={<Queries />} />
            <Route path="/dashboard/profile" element={<Profile />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/dashboard/control-unit" element={<ControlUnit />} />
            <Route path="/dashboard/control-unit/:userId" element={<ManageAccess />} />
            <Route path="/dashboard/approvals" element={<Approvals />} />
            <Route path="/dashboard/notifications" element={<Notifications />} />

            {/* ===== Modules ===== */}
            <Route path="/dashboard/clients" element={<Clients />} />
            <Route path="/dashboard/employees" element={<Employees />} />
            <Route path="/dashboard/users" element={<Users />} />
            <Route path="/dashboard/materials" element={<Materials />} />
            <Route path="/dashboard/materials/:id/history" element={<MaterialHistory />} />
            <Route path="/dashboard/projects" element={<ProjectManagement />} />
            <Route path="/dashboard/projects/:id" element={<ProjectDetail />} />
            <Route path="/dashboard/assignments" element={<Assignments />} />
            <Route path="/dashboard/attendance" element={<Attendance />} />
            <Route path="/dashboard/attendance/:id" element={<MarkAttendance />} />
            <Route path="/dashboard/salaries" element={<Salaries />} />
            <Route path="/dashboard/salaries/payslip/:employeeId" element={<Payslip />} />
            <Route path="/dashboard/billing" element={<Billing />} />
            <Route path="/dashboard/billing/project/:projectId" element={<ProjectBilling />} />
            <Route path="/dashboard/billing/invoice/:invoiceId/print" element={<InvoicePrint />} />
            <Route path="/dashboard/ai" element={<UnderConstruction title="AI Assistant" />} />
            <Route path="/dashboard/reports" element={<Reports />} />
            <Route path="/dashboard/field" element={<FieldView />} />
            <Route path="/dashboard/material-requests" element={<MaterialRequests />} />
          </Route>

          {/* ===== Fallback ===== */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </PermissionProvider>
    </AuthProvider>
  );
}

export default App;
