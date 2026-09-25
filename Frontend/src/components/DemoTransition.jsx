import { useAuth } from "../context/AuthContext";
import { getDemoRole } from "../config/demoConfig";
import DemoRoleIcon from "./DemoRoleIcon";
import "./DemoTransition.css";


function DemoTransition() {
  const { demoTransition } = useAuth();
  if (!demoTransition) return null;

  const role = getDemoRole(demoTransition.role);

  return (
    <div className={`dmt dmt-${demoTransition.phase}`} role="status" aria-live="polite">
      <div className="dmt-card">
        <div className="dmt-icon">
          <DemoRoleIcon role={role.key} />
        </div>
        <p className="dmt-kicker">{demoTransition.title}</p>
        <h3 className="dmt-role">{demoTransition.label || `${role.label} view`}</h3>
        <p className="dmt-tagline">{role.tagline}</p>
        <div className="dmt-progress"><span /></div>
      </div>
    </div>
  );
}

export default DemoTransition;
