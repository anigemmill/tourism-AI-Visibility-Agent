import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface FactCheckDraft {
  field: "price" | "hours" | "location" | "inclusions" | "policy" | "description";
  severity: "critical" | "high" | "medium" | "low";
  sourcePlatform: string;
  sourceUrl?: string;
  claimedValue: string;
  actualValue?: string;
  bookingImpact: number; // 0-1
}

const PRICE_RE = /(NZ\$|AU\$|US\$|£|€|\$)\s?(\d{1,4}(?:[.,]\d{2})?)/i;
const NEGATIVE_CANCELLATION_RE = /no\s+(refund|cancellation)|non-?refundable/i;
const POSITIVE_CANCELLATION_RE = /free\s+cancellation|full\s+refund|flexible\s+cancellation/i;

/**
 * Diffs the business's own knowledge profile — treated as the source of
 * truth, since it comes from the business's own site — against what AI
 * platforms and third-party sources are actually saying in monitored
 * discovery results. Only flags a concrete, textual disagreement between
 * the two; never infers an error without both a claimed value (from the
 * response) and an actual value (from the profile) to compare.
 */
export async function runFactCheck(businessId: string): Promise<FactCheckDraft[]> {
  const [products, policies, results] = await Promise.all([
    prisma.product.findMany({ where: { businessId } }),
    prisma.policy.findMany({ where: { businessId } }),
    prisma.discoveryResult.findMany({
      where: { businessId, businessAppears: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const drafts: FactCheckDraft[] = [];

  for (const result of results) {
    drafts.push(...checkPrices(result, products));
    drafts.push(...checkCancellationPolicy(result, policies));
  }

  return dedupe(drafts);
}

export function checkPrices(
  result: Prisma.DiscoveryResultGetPayload<Record<string, never>>,
  products: Prisma.ProductGetPayload<Record<string, never>>[]
): FactCheckDraft[] {
  if (products.length === 0) return [];
  const drafts: FactCheckDraft[] = [];
  const matches = [...result.responseText.matchAll(new RegExp(PRICE_RE, "gi"))];

  for (const m of matches) {
    const claimedAmount = Number(m[2].replace(",", "."));
    // Compare against any product priced within a plausible range; flag the
    // closest one only if the discrepancy is real (>15% difference).
    const withPrice = products.filter((p) => p.priceAmount != null);
    if (withPrice.length === 0) continue;
    const closest = withPrice.reduce((best, p) => {
      const diff = Math.abs(Number(p.priceAmount) - claimedAmount);
      const bestDiff = Math.abs(Number(best.priceAmount) - claimedAmount);
      return diff < bestDiff ? p : best;
    });
    const actual = Number(closest.priceAmount);
    const pctDiff = actual === 0 ? 1 : Math.abs(actual - claimedAmount) / actual;

    if (pctDiff > 0.15) {
      drafts.push({
        field: "price",
        severity: pctDiff > 0.4 ? "critical" : "high",
        sourcePlatform: result.platform,
        claimedValue: `${m[0]} (mentioned for "${closest.name}")`,
        actualValue: `${closest.priceCurrency ?? ""} ${actual}${closest.priceUnit ? ` ${closest.priceUnit}` : ""}`.trim(),
        bookingImpact: 0.85,
      });
    }
  }
  return drafts;
}

export function checkCancellationPolicy(
  result: Prisma.DiscoveryResultGetPayload<Record<string, never>>,
  policies: Prisma.PolicyGetPayload<Record<string, never>>[]
): FactCheckDraft[] {
  const cancellationPolicy = policies.find((p) => p.type.toLowerCase().includes("cancel"));
  if (!cancellationPolicy) return [];

  const responseClaimsNegative = NEGATIVE_CANCELLATION_RE.test(result.responseText);
  const responseClaimsPositive = POSITIVE_CANCELLATION_RE.test(result.responseText);
  const policyIsPositive = POSITIVE_CANCELLATION_RE.test(cancellationPolicy.summary);
  const policyIsNegative = NEGATIVE_CANCELLATION_RE.test(cancellationPolicy.summary);

  if ((responseClaimsNegative && policyIsPositive) || (responseClaimsPositive && policyIsNegative)) {
    return [
      {
        field: "policy",
        severity: "high",
        sourcePlatform: result.platform,
        claimedValue: extractSnippet(result.responseText, responseClaimsNegative ? NEGATIVE_CANCELLATION_RE : POSITIVE_CANCELLATION_RE),
        actualValue: cancellationPolicy.summary,
        bookingImpact: 0.7,
      },
    ];
  }
  return [];
}

function extractSnippet(text: string, re: RegExp): string {
  const m = re.exec(text);
  if (!m) return text.slice(0, 120);
  const start = Math.max(0, m.index - 40);
  return text.slice(start, m.index + m[0].length + 40).trim();
}

function dedupe(drafts: FactCheckDraft[]): FactCheckDraft[] {
  const seen = new Set<string>();
  return drafts.filter((d) => {
    const key = `${d.field}:${d.claimedValue}:${d.sourcePlatform}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function saveFactCheckIssues(businessId: string, drafts: FactCheckDraft[]) {
  const existing = await prisma.factCheckIssue.findMany({
    where: { businessId, status: "open" },
    select: { field: true, claimedValue: true, sourcePlatform: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.field}:${e.claimedValue}:${e.sourcePlatform}`));
  const toCreate = drafts.filter((d) => !existingKeys.has(`${d.field}:${d.claimedValue}:${d.sourcePlatform}`));
  if (toCreate.length === 0) return [];

  await prisma.factCheckIssue.createMany({
    data: toCreate.map((d) => ({ businessId, ...d })),
  });
  return toCreate;
}
