import { prisma } from "@/lib/db";

const PIPELINE_COOLDOWN_MINUTES = Number(process.env.PIPELINE_COOLDOWN_MINUTES || 15);
const MAX_DISCOVERY_RESULTS_PER_DAY = Number(process.env.MAX_DISCOVERY_RESULTS_PER_DAY_PER_BUSINESS || 500);
export const MONITORING_CONCURRENCY = Number(process.env.MONITORING_CONCURRENCY || 4);

export interface CooldownCheck {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Full pipeline runs hit multiple paid AI APIs per business. This cooldown
 * stops a user (or a misbehaving client) from re-triggering it faster than
 * `PIPELINE_COOLDOWN_MINUTES` apart, independent of who or what triggers it
 * (dashboard button, onboarding, or the daily cron).
 */
export async function checkPipelineCooldown(businessId: string): Promise<CooldownCheck> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { lastPipelineRunAt: true },
  });
  if (!business?.lastPipelineRunAt) return { allowed: true };

  const elapsedMs = Date.now() - business.lastPipelineRunAt.getTime();
  const cooldownMs = PIPELINE_COOLDOWN_MINUTES * 60_000;
  if (elapsedMs >= cooldownMs) return { allowed: true };

  return { allowed: false, retryAfterSeconds: Math.ceil((cooldownMs - elapsedMs) / 1000) };
}

export async function markPipelineRun(businessId: string): Promise<void> {
  await prisma.business.update({ where: { id: businessId }, data: { lastPipelineRunAt: new Date() } });
}

/**
 * Caps how many DiscoveryResult rows (i.e. paid AI/search calls) a single
 * business can generate per rolling day, so one business with a large
 * query list can't silently run up the bill. Monitoring stops issuing new
 * calls once the remaining budget hits zero, rather than failing outright.
 */
export async function getRemainingMonitoringQuota(businessId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usedToday = await prisma.discoveryResult.count({
    where: { businessId, createdAt: { gte: since }, isDemoData: false },
  });
  return Math.max(0, MAX_DISCOVERY_RESULTS_PER_DAY - usedToday);
}
