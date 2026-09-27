// Reads the expiry time of a sign-in token (JWT) in milliseconds, or null when the token
// can't be read (it is then left to the server to accept or refuse it).
export function tokenExpiresAt(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}
