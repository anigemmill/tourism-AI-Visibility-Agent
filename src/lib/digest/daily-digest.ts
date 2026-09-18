import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface DigestActionItem {
  action: string;
  priority: "critical" | "high" | "medium" | "low";
  opportunityId?: string;
  factCheckIssueId?: string;
}

export interface DailyDigestContent {
  whatChanged: string;
  whyItMatters: string;
  whatToDo: DigestActionItem[];
}

const SIGNIFICANT_DELTA = 3; // points

/**
 * Builds the daily "what changed / why it matters / what to do" digest by
 * diffing the two most recent visibility snapshots and pulling in newly
 * opened fact-check issues and content opportunities since the last run.
 * Every line traces back to a stored signal — nothing here is invented
 * commentary.
 */
export async function generateDailyDigest(businessId: string): Promise<DailyDigestContent> {
  const [business, snapshots, openOpportunities, openIssues] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.visibilitySnapshot.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 2,
      include: { components: true },
    }),
    prisma.contentOpportunity.findMany({
      where: { businessId, status: "open" },
      orderBy: { priorityScore: "desc" },
      take: 5,
    }),
    prisma.factCheckIssue.findMany({
      where: { businessId, status: "open" },
      orderBy: { bookingImpact: "desc" },
      take: 5,
    }),
  ]);

  const [latest, previous] = snapshots;
  const whatChanged = buildWhatChanged(business.name, latest, previous, openOpportunities.length, openIssues.length);
  const whyItMatters = buildWhyItMatters(latest, previous, openIssues);
  const whatToDo = buildWhatToDo(openOpportunities, openIssues);

  return { whatChanged, whyItMatters, whatToDo };
}

type Snapshot = Prisma.VisibilitySnapshotGetPayload<{ include: { components: true } }>;

function buildWhatChanged(
  businessName: string,
  latest: Snapshot | undefined,
  previous: Snapshot | undefined,
  openOpportunityCount: number,
  openIssueCount: number
): string {
  const lines: string[] = [];

  if (!latest) {
    return `No visibility snapshot has been computed yet for ${businessName}. Run a monitoring pass and recompute the visibility score to start tracking daily change.`;
  }

  if (!previous) {
    lines.push(`First visibility snapshot recorded for ${businessName}. This is the baseline — future digests will compare against it.`);
  } else {
    for (const component of latest.components) {
      const prevComponent = previous.components.find((c) => c.key === component.key);
      if (!prevComponent) continue;
      const delta = component.score - prevComponent.score;
      if (Math.abs(delta) >= SIGNIFICANT_DELTA) {
        lines.push(
          `**${component.label}** ${delta > 0 ? "improved" : "declined"} from ${prevComponent.score} to ${component.score} (${delta > 0 ? "+" : ""}${delta}).`
        );
      }
    }
    if (lines.length === 0) {
      lines.push("No significant movement in visibility scores since the last snapshot.");
    }
  }

  if (openOpportunityCount > 0) {
    lines.push(`${openOpportunityCount} content opportunit${openOpportunityCount === 1 ? "y remains" : "ies remain"} open.`);
  }
  if (openIssueCount > 0) {
    lines.push(`${openIssueCount} unresolved fact-check issue${openIssueCount === 1 ? "" : "s"} found in AI/search responses.`);
  }

  return lines.join("\n");
}

function buildWhyItMatters(
  latest: Snapshot | undefined,
  previous: Snapshot | undefined,
  openIssues: Prisma.FactCheckIssueGetPayload<Record<string, never>>[]
): string {
  const lines: string[] = [];

  if (latest && previous) {
    const worst = latest.components
      .map((c) => ({ c, prev: previous.components.find((p) => p.key === c.key) }))
      .filter((x) => x.prev && x.c.score - x.prev.score <= -SIGNIFICANT_DELTA)
      .sort((a, b) => a.c.score - a.prev!.score - (b.c.score - b.prev!.score))[0];
    if (worst) {
      lines.push(`The drop in **${worst.c.label}** is the most commercially significant change: ${worst.c.explanation}`);
    }
    const best = latest.components
      .map((c) => ({ c, prev: previous.components.find((p) => p.key === c.key) }))
      .filter((x) => x.prev && x.c.score - x.prev.score >= SIGNIFICANT_DELTA)
      .sort((a, b) => b.c.score - b.prev!.score - (a.c.score - a.prev!.score))[0];
    if (best) {
      lines.push(`The gain in **${best.c.label}** is worth reinforcing: ${best.c.explanation}`);
    }
  }

  const criticalIssue = openIssues.find((i) => i.severity === "critical" || i.bookingImpact >= 0.8);
  if (criticalIssue) {
    lines.push(
      `A high-impact factual error is live: AI/search sources report "${criticalIssue.claimedValue}" for ${criticalIssue.field}, which could directly cost bookings if a traveller acts on it.`
    );
  }

  if (lines.length === 0) {
    lines.push("No high-impact changes today — visibility is stable. Use today to work through open content opportunities.");
  }

  return lines.join("\n");
}

function buildWhatToDo(
  opportunities: Prisma.ContentOpportunityGetPayload<Record<string, never>>[],
  issues: Prisma.FactCheckIssueGetPayload<Record<string, never>>[]
): DigestActionItem[] {
  const items: DigestActionItem[] = [];

  for (const issue of issues) {
    items.push({
      action: `Correct the record: ${issue.field} shown as "${issue.claimedValue}" via ${issue.sourcePlatform}${issue.actualValue ? ` (should be "${issue.actualValue}")` : ""}.`,
      priority: issue.bookingImpact >= 0.75 ? "critical" : issue.bookingImpact >= 0.5 ? "high" : "medium",
      factCheckIssueId: issue.id,
    });
  }

  for (const opp of opportunities) {
    items.push({
      action: opp.title,
      priority: opp.priorityScore >= 75 ? "critical" : opp.priorityScore >= 55 ? "high" : opp.priorityScore >= 35 ? "medium" : "low",
      opportunityId: opp.id,
    });
  }

  const priorityOrder: Record<DigestActionItem["priority"], number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 8);
}

export async function saveDailyDigest(businessId: string, content: DailyDigestContent) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.dailyDigest.upsert({
    where: { businessId_date: { businessId, date: today } },
    create: {
      businessId,
      date: today,
      whatChanged: content.whatChanged,
      whyItMatters: content.whyItMatters,
      whatToDo: content.whatToDo as unknown as Prisma.InputJsonValue,
    },
    update: {
      whatChanged: content.whatChanged,
      whyItMatters: content.whyItMatters,
      whatToDo: content.whatToDo as unknown as Prisma.InputJsonValue,
    },
  });
}
