// The password rule, the same as the server's (Backend/Auth/PasswordPolicy.cs), and a
// strength score for the meter under password fields.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const hasLetter = (pw) => /\p{L}/u.test(pw);
const hasNumber = (pw) => /\d/.test(pw);

// The message for the first rule the password breaks, or null when it is fine.
export function passwordError(pw) {
  if (!pw) return "Enter a password.";
  if (pw.length < PASSWORD_MIN) return `The password must be at least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return `The password can be at most ${PASSWORD_MAX} characters.`;
  if (pw !== pw.trim()) return "The password can't start or end with a space.";
  if (!hasLetter(pw) || !hasNumber(pw)) return "Use at least one letter and one number.";
  return null;
}

// The checklist under the field.
export function passwordChecks(pw) {
  return [
    { key: "length", label: `At least ${PASSWORD_MIN} characters`, ok: pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX },
    { key: "mix", label: "A letter and a number", ok: hasLetter(pw) && hasNumber(pw) },
  ];
}

// 0 (empty) to 4. A password that breaks a rule is never more than Weak.
export function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "" };
  let score = 1;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 10 && kinds >= 2) score++;
  if (pw.length >= 12 && kinds >= 3) score++;
  if ((pw.length >= 14 && kinds >= 3) || (pw.length >= 12 && kinds === 4)) score++;
  if (passwordError(pw)) score = 1;
  return { score, label: ["", "Weak", "Fair", "Good", "Strong"][score] };
}
