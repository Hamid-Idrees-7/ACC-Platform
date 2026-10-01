import { Fragment, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import { PermissionProvider } from "./context/PermissionContext";
import { PreferencesProvider, usePreferences } from "./context/PreferencesContext";
import { CompanyProvider, useCompany } from "./context/CompanyContext";
import DemoTransition from "./components/DemoTransition";
import SessionWatch from "./components/SessionWatch";
import LiveConnection from "./components/LiveConnection";

import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PageLoader from "./components/PageLoader";
import ErrorBoundary from "./components/ErrorBoundary";
import ConnectionBanner from "./components/ConnectionBanner";
import { pages, prefetchDashboardPages } from "./routes/lazyPages";

const {
  About, Projects, Privacy, ResetPassword, Dashboard, Queries, Profile, Settings, ControlUnit, ManageAccess, Approvals,
  Notifications, Alerts, Clients, Employees, Users, Materials, MaterialHistory, ProjectManagement,
  ProjectDetail, Assignments, Attendance, MarkAttendance, Salaries, Payslip, Billing, ProjectBilling,
  InvoicePrint, Reports, FieldView, MaterialRequests, UnderConstruction,
} = pages;

// Dashboard pages need a signed-in user. Anyone else goes to the sign-in page, which sends
// them back to the page they asked for afterwards.
// The pages remount when the signed-in person changes (eg a live demo role switch), so they
// reload their data for the new user. They also redraw once if the number or date format, or
// the company currency, from the server differs from the cached one. Changes in
// Settings > Appearance don't remount, so the page doesn't jump back to the top.
function SignedInBoundary() {
  const { user, exitTo } = useAuth();
  const { formatVersion } = usePreferences();
  const { companyVersion } = useCompany();
  const location = useLocation();
  const signedIn = !!user;

  useEffect(() => {
    if (signedIn) prefetchDashboardPages();
  }, [signedIn]);

  if (!user) {
    if (exitTo) return <Navigate to={exitTo} replace />;
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  const identity = `${user.userID}:${user.username}`;
  return (
    <>
      <Fragment key={`${identity}|${formatVersion}|${companyVersion}`}>
        <Outlet />
      </Fragment>
      <SessionWatch />
    </>
  );
}

function RouteErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
      <CompanyProvider>
      <PermissionProvider>
      {/* Live demo role-change card: lives above the routes so it survives page changes */}
      <DemoTransition />
      <LiveConnection />
      <ConnectionBanner />
      <BrowserRouter>
        <RouteErrorBoundary>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public website */}
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<SignedInBoundary />}>
            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/queries" element={<Queries />} />
            <Route path="/dashboard/profile" element={<Profile />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/dashboard/control-unit" element={<ControlUnit />} />
            <Route path="/dashboard/control-unit/:userId" element={<ManageAccess />} />
            <Route path="/dashboard/approvals" element={<Approvals />} />
            <Route path="/dashboard/notifications" element={<Notifications />} />
            <Route path="/dashboard/alerts" element={<Alerts />} />

            {/* Modules */}
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

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </RouteErrorBoundary>
      </BrowserRouter>
      </PermissionProvider>
      </CompanyProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}

export default App;
