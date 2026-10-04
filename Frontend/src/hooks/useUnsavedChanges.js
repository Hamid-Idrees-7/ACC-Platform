import { useEffect } from "react";

const dirtyPages = new Set();

export const hasUnsavedChanges = () => dirtyPages.size > 0;

// In-page "Back" buttons go through here, so unsaved work gets the same "Leave without
// saving?" prompt as the sidebar (DashboardLayout shows it).
export const LEAVE_REQUEST_EVENT = "acc-leave-request";
export const leaveSafely = (action) => {
  if (!hasUnsavedChanges()) {
    action();
    return;
  }
  window.dispatchEvent(new CustomEvent(LEAVE_REQUEST_EVENT, { detail: action }));
};

// Exits that must not be stopped (sign-out, an ended demo, a demo role switch, or a "Leave"
// the user already confirmed): the unsaved-changes check lets this navigation through.
let forced = false;
export const isLeaveForced = () => forced;
export const leaveWithoutAsking = (action) => {
  forced = true;
  try {
    action();
  } finally {
    setTimeout(() => { forced = false; }, 0);
  }
};

export function useUnsavedChanges(dirty) {
  useEffect(() => {
    if (!dirty) return;
    const token = {};
    dirtyPages.add(token);
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      dirtyPages.delete(token);
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);
}
