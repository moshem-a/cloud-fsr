import type { Config } from "../config.ts";

/**
 * Hard gate: rejects any user whose email domain is not in the allowlist.
 * `ALLOWED_EMAIL_DOMAIN` accepts a comma-separated list (e.g. "google.com,altostrat.com").
 */
export function isAllowedEmail(
  email: string | undefined,
  config: Pick<Config, "ALLOWED_EMAIL_DOMAIN">,
): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  const allowed = config.ALLOWED_EMAIL_DOMAIN.toLowerCase()
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  return allowed.includes(domain);
}
