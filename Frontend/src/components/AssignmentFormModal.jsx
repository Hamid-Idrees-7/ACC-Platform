import { useState, useMemo } from "react";
import DatePicker from "./DatePicker";
import { formatDate } from "../utils/dates";
import { amountInWords, currencySymbol } from "../utils/format";
import "./AssignmentFormModal.css";
import ModalOverlay from "./ModalOverlay";

const WAGE_TYPES = [
  { value: "Daily", label: "Daily (Dehari)" },
  { value: "Monthly", label: "Monthly" },
  { value: "Contract", label: "Contract" },
];

const wageLabel = (type) =>
  `${type === "Monthly" ? "Monthly Salary" : type === "Contract" ? "Contract Amount" : "Daily Wage"} (${currencySymbol()})`;

function AssignmentFormModal({ mode, initialData, employees = [], projects = [], assignments = [], onClose, onSave }) {
  const isEdit = mode === "edit";
  // The assignment being edited, or nothing for a new one.
  const start = isEdit && initialData ? initialData : {};
  const [role, setRole] = useState(start.role || "");
  const [employeeID, setEmployeeID] = useState(start.employeeID || "");
  const [projectID, setProjectID] = useState(start.projectID || "");
  const [wageType, setWageType] = useState(start.wageType || "Daily");
  const [wageAmount, setWageAmount] = useState(start.wageAmount ?? "");
  const [startDate, setStartDate] = useState(start.startDate ? start.startDate.split("T")[0] : "");
  const [endDate, setEndDate] = useState(start.endDate ? start.endDate.split("T")[0] : "");
  const [status, setStatus] = useState(start.status || "Active");
  const [notes, setNotes] = useState(start.notes || "");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  // An edited assignment always keeps its own person and project in the lists, even if the
  // person is inactive now or the project closed, so the form never shows them blank.
  const ownEmployee = isEdit ? start.employeeID : null;
  const ownProject = isEdit ? start.projectID : null;

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "Active" || e.employeeID === ownEmployee),
    [employees, ownEmployee]
  );

  const roles = useMemo(() => {
    const map = {};
    activeEmployees.forEach((e) => {
      if (e.designation) map[e.designation] = (map[e.designation] || 0) + 1;
    });
    if (isEdit && start.role && !map[start.role]) map[start.role] = 1;
    return Object.entries(map).map(([r, count]) => ({ role: r, count })).sort((a, b) => a.role.localeCompare(b.role));
  }, [activeEmployees, isEdit, start.role]);

  const employeesForRole = useMemo(
    () => activeEmployees.filter((e) => e.designation === role || (e.employeeID === ownEmployee && role === start.role)),
    [activeEmployees, role, ownEmployee, start.role]
  );

  const activeProjects = useMemo(
    () => projects.filter((p) => (p.status !== "Completed" && p.status !== "Cancelled") || p.projectID === ownProject),
    [projects, ownProject]
  );

  const overlaps = useMemo(() => {
    if (!employeeID) return [];
    return assignments.filter(
      (a) => String(a.employeeID) === String(employeeID) && a.status === "Active" && (!isEdit || a.assignmentID !== initialData?.assignmentID)
    );
  }, [assignments, employeeID, isEdit, initialData]);

  const onRoleChange = (r) => {
    setRole(r);
    setEmployeeID("");
    setErrors((e) => ({ ...e, role: "", employeeID: "" }));
  };

  const validate = () => {
    const e = {};
    if (!role) e.role = "Select a role.";
    if (!employeeID) e.employeeID = "Select an employee.";
    if (!projectID) e.projectID = "Select a project.";
    if (wageAmount === "" || Number(wageAmount) <= 0) e.wageAmount = "Enter a valid wage.";
    if (!startDate) e.startDate = "Start date is required.";
    if (startDate && endDate && endDate < startDate) e.endDate = "The end date can't be before the start date.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setServerError("");
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        employeeID: Number(employeeID),
        projectID: Number(projectID),
        role,
        wageType,
        wageAmount: Number(wageAmount),
        startDate,
        endDate: endDate || null,
        status,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setServerError(err.response?.data?.message || "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <ModalOverlay className="afm-overlay" onClose={onClose}>
      <div className="afm-modal">
        <div className="afm-head">
          <div>
            <h3>{isEdit ? "Edit Assignment" : "New Assignment"}</h3>
            <p>Choose role → employee → project. Wage is set per assignment.</p>
          </div>
          <button className="afm-close" data-close onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {serverError && <div className="afm-server-error">{serverError}</div>}

        {overlaps.length > 0 && (
          <div className="afm-overlap">
            <strong>Heads up:</strong> this employee is already active on:
            <ul>
              {overlaps.map((a) => (
                <li key={a.assignmentID}>{a.projectTitle} ({formatDate(a.startDate)}{a.endDate ? ` → ${formatDate(a.endDate)}` : " → ongoing"})</li>
              ))}
            </ul>
            <span>
              {wageType === "Monthly" && overlaps.some((a) => a.wageType === "Monthly")
                ? "A monthly salary is paid once per person, not per project. This wage replaces the current monthly wage from its start date."
                : "You can still proceed."}
            </span>
          </div>
        )}

        <div className="afm-body">
          <div className="afm-grid">
            <div className="afm-field">
              <label>1. Role / Designation <span className="req">*</span></label>
              <select value={role} onChange={(e) => onRoleChange(e.target.value)} className={errors.role ? "err" : ""}>
                <option value="">-- Select Role First --</option>
                {roles.map((r) => <option key={r.role} value={r.role}>{r.role} ({r.count} available)</option>)}
              </select>
              {errors.role && <span className="afm-err">{errors.role}</span>}
            </div>

            <div className="afm-field">
              <label>2. Employee <span className="req">*</span></label>
              <select value={employeeID} onChange={(e) => { setEmployeeID(e.target.value); setErrors((x) => ({ ...x, employeeID: "" })); }} className={errors.employeeID ? "err" : ""} disabled={!role}>
                <option value="">{role ? "-- Select Employee --" : "-- Select Role First --"}</option>
                {employeesForRole.map((e) => <option key={e.employeeID} value={e.employeeID}>{e.fullName}</option>)}
              </select>
              {errors.employeeID && <span className="afm-err">{errors.employeeID}</span>}
            </div>

            <div className="afm-field">
              <label>3. Project <span className="req">*</span></label>
              <select value={projectID} onChange={(e) => { setProjectID(e.target.value); setErrors((x) => ({ ...x, projectID: "" })); }} className={errors.projectID ? "err" : ""}>
                <option value="">-- Select Project --</option>
                {activeProjects.map((p) => <option key={p.projectID} value={p.projectID}>{p.title}</option>)}
              </select>
              {errors.projectID ? <span className="afm-err">{errors.projectID}</span> : <span className="afm-hint">Only active projects shown</span>}
            </div>

            <div className="afm-field">
              <label>Wage Type <span className="req">*</span></label>
              <select value={wageType} onChange={(e) => setWageType(e.target.value)}>
                {WAGE_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>

            <div className="afm-field">
              <label>{wageLabel(wageType)} <span className="req">*</span></label>
              <input type="number" min="0" step="any" value={wageAmount} onChange={(e) => { setWageAmount(e.target.value); setErrors((x) => ({ ...x, wageAmount: "" })); }} className={errors.wageAmount ? "err" : ""} placeholder="Wage" />
              {errors.wageAmount ? <span className="afm-err">{errors.wageAmount}</span> : wageAmount !== "" && Number(wageAmount) > 0 ? <span className="afm-num">= {amountInWords(wageAmount)}</span> : null}
            </div>

            <div className="afm-field">
              <label>Start Date <span className="req">*</span></label>
              <DatePicker value={startDate} onChange={(v) => { setStartDate(v); setErrors((x) => ({ ...x, startDate: "" })); }} placeholder="Select start date" />
              {errors.startDate && <span className="afm-err">{errors.startDate}</span>}
            </div>

            <div className="afm-field">
              <label>End Date</label>
              <DatePicker value={endDate} onChange={(v) => { setEndDate(v); setErrors((x) => ({ ...x, endDate: "" })); }} placeholder="Leave blank if ongoing" />
              {errors.endDate && <span className="afm-err">{errors.endDate}</span>}
            </div>

            <div className="afm-field">
              <label>Status <span className="req">*</span></label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="afm-field afm-field-full">
              <label>Notes</label>
              <input type="text" maxLength={255} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special remarks, terms, conditions..." autoComplete="off" />
            </div>
          </div>
        </div>

        <div className="afm-actions">
          <button className="afm-cancel" data-close onClick={onClose} disabled={saving}>Cancel</button>
          <button className="afm-save" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Assignment"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

export default AssignmentFormModal;
