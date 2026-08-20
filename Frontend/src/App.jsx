import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import { PermissionProvider } from "./context/PermissionContext";

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


import UnderConstruction from "./pages/UnderConstruction";

function App() {
  return (
    <AuthProvider>
      <PermissionProvider>
      <BrowserRouter>
        <Routes>
          {/* ===== Public website ===== */}
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/login" element={<Login />} />

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
          

          <Route path="/dashboard/assignments" element={<UnderConstruction title="Assignments" />} />
          <Route path="/dashboard/projects" element={<UnderConstruction title="Projects" />} />
          <Route path="/dashboard/attendance" element={<UnderConstruction title="Attendance" />} />
          <Route path="/dashboard/salaries" element={<UnderConstruction title="Salaries" />} />
          <Route path="/dashboard/billing" element={<UnderConstruction title="Billing & Invoices" />} />
          <Route path="/dashboard/approvals" element={<UnderConstruction title="Approvals" />} />
          <Route path="/dashboard/ai" element={<UnderConstruction title="AI Assistant" />} />
          <Route path="/dashboard/reports" element={<UnderConstruction title="Reports" />} />



          {/* ===== Fallback ===== */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </PermissionProvider>
    </AuthProvider>
  );
}

export default App;
