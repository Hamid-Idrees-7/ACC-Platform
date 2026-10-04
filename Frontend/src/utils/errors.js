// Why a page could not load its data: no permission, not there, or anything else
// (offline, server error), so the page can say the right thing.
export const loadFailure = (err) => {
  const status = err?.response?.status;
  if (status === 403) return "denied";
  if (status === 404) return "missing";
  return "failed";
};

export const NO_ACCESS_TITLE = "You don't have access to this";
export const NO_ACCESS_TEXT = "Contact your administration.";
