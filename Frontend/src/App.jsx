import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

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

// Modules
import Clients from "./pages/Clients";
import Employees from "./pages/Employees";


import UnderConstruction from "./pages/UnderConstruction";

function App() {
  return (
    <AuthProvider>
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

          {/* ===== Modules ===== */}
          <Route path="/dashboard/clients" element={<Clients />} />
          <Route path="/dashboard/employees" element={<Employees />} />

          <Route path="/dashboard/users" element={<UnderConstruction title="Users" />} />
          <Route path="/dashboard/materials" element={<UnderConstruction title="Materials" />} />
          <Route path="/dashboard/assignments" element={<UnderConstruction title="Assignments" />} />
          <Route path="/dashboard/projects" element={<UnderConstruction title="Projects" />} />
          <Route path="/dashboard/attendance" element={<UnderConstruction title="Attendance" />} />
          <Route path="/dashboard/salaries" element={<UnderConstruction title="Salaries" />} />
          <Route path="/dashboard/billing" element={<UnderConstruction title="Billing & Invoices" />} />
          <Route path="/dashboard/notifications" element={<UnderConstruction title="Notifications" />} />
          <Route path="/dashboard/settings" element={<UnderConstruction title="Settings" />} />
          <Route path="/dashboard/approvals" element={<UnderConstruction title="Approvals" />} />
          <Route path="/dashboard/control-unit" element={<UnderConstruction title="Control Unit" />} />
          <Route path="/dashboard/ai" element={<UnderConstruction title="AI Assistant" />} />
          <Route path="/dashboard/reports" element={<UnderConstruction title="Reports" />} />



          {/* ===== Fallback ===== */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
