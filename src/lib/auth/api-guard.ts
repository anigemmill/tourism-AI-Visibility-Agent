import { prisma } from "@/lib/db";
import { getSession } from "./get-session";
import type { SessionPayload } from "./session";

/** For API routes: returns the verified session, or null if unauthenticated. */
export async function requireSession(): Promise<SessionPayload | null> {
  return getSession();
}

/**
 * For API routes scoped to a single business: verifies the caller is signed
 * in AND that the business belongs to their account. Returns null for both
 * "not signed in" and "belongs to someone else" — callers should respond
 * 404 either way so cross-tenant requests can't distinguish "doesn't exist"
 * from "exists but isn't yours."
 */
export async function requireBusinessAccess(businessId: string) {
  const session = await getSession();
  if (!session) return null;

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business || business.accountId !== session.accountId) return null;

  return { session, business };
}
