import { cookies } from "next/headers";

const COOKIE_NAME = "match-web-secret";

function isMatchCreationDisabled(): boolean {
  return process.env.DISABLE_CREATE_MATCH_ON_WEB === "true";
}

/**
 * For use in server components — reads cookie via next/headers.
 */
export async function isMatchCreationAllowed(): Promise<boolean> {
  if (!isMatchCreationDisabled()) return true;

  const override = process.env.MATCH_ON_WEB_OVERRIDE;
  if (!override) return false;

  const cookieStore = await cookies();
  const secretCookie = cookieStore.get(COOKIE_NAME);
  return secretCookie?.value === override;
}

/**
 * For use in API route handlers — reads cookie from the Request object.
 */
export function isMatchCreationAllowedFromRequest(request: Request): boolean {
  if (!isMatchCreationDisabled()) return true;

  const override = process.env.MATCH_ON_WEB_OVERRIDE;
  if (!override) return false;

  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  const value = match?.split("=")[1];
  return value === override;
}
