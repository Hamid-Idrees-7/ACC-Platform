// Sign-in sessions: automatic sign-out after inactivity, and what happens when the server
// ends a session (signed out on another device, password changed, account disabled...).

// Fired by the API client when the server answers that the session has ended.
export const SESSION_ENDED_EVENT = "acc-session-ended";

// Message shown once on the sign-in page (sessionStorage, this tab only).
export const LOGIN_NOTE_KEY = "acc-login-note";

// Why this browser was signed out, so other open tabs can show the same message (localStorage).
export const SIGNOUT_NOTE_KEY = "acc-signout-note";

// Time of the last click or key press in any tab (localStorage), for automatic sign-out.
export const ACTIVITY_KEY = "acc-last-activity";

// Choices in Settings > Security (minutes, 0 = off). Same list as the server.
export const IDLE_CHOICES = [
  { minutes: 0, label: "Off", hint: "Stay signed in until you log out" },
  { minutes: 15, label: "15 minutes", hint: "Best for shared computers" },
  { minutes: 30, label: "30 minutes", hint: "Recommended" },
  { minutes: 60, label: "1 hour", hint: "For long work at your own desk" },
];
export const DEFAULT_IDLE_MINUTES = 30;

// The warning appears this long before automatic sign-out.
export const IDLE_WARNING_SECONDS = 60;

// A token with less than this left is renewed before the next request (while the user works).
export const RENEW_BEFORE_MS = 30 * 60 * 1000;

export const idleLabel = (minutes) => (minutes === 60 ? "1 hour" : `${minutes} minutes`);
