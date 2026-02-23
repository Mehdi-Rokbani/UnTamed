// src/utils/passwordRules.ts
export type PasswordChecks = {
  len: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  symbol: boolean;
  noSpace: boolean;
  noUsername: boolean; // optional hardening
  noEmail: boolean;    // optional hardening
};

export type PasswordRulesResult = {
  checks: PasswordChecks;
  score: number;       // number of passed checks
  maxScore: number;
  requiredOk: boolean; // strict policy gate (what blocks Next)
};

export function passwordRules(
  password: string,
  username?: string,
  email?: string
): PasswordRulesResult {
  const pw = password ?? "";

  const checks: PasswordChecks = {
    len: pw.length >= 8,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
    noSpace: !/\s/.test(pw),
    noUsername: true,
    noEmail: true,
  };

  // Optional hardening: prevent including username/email local-part
  const pLower = pw.toLowerCase();
  const u = (username ?? "").trim().toLowerCase();
  if (u.length >= 3) checks.noUsername = !pLower.includes(u);

  const local = (email ?? "").trim().toLowerCase().split("@")[0] ?? "";
  if (local.length >= 3) checks.noEmail = !pLower.includes(local);

  const values = Object.values(checks);
  const score = values.filter(Boolean).length;

  // Gate: strict “must pass” set.
  // (You can decide whether to include noUsername/noEmail as required.)
  const requiredOk =
    checks.len &&
    checks.lower &&
    checks.upper &&
    checks.digit &&
    checks.symbol &&
    checks.noSpace;

  return { checks, score, maxScore: values.length, requiredOk };
}
