import pLimit from "p-limit";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getConnectors } from "@/lib/connectors/registry";
import { DemoConnector } from "@/lib/connectors/demo-connector";
import type { DemoContext } from "@/lib/connectors/types";
import { analyzeMention } from "./analyze-mention";
import { checkPipelineCooldown, getRemainingMonitoringQuota, markPipelineRun, MONITORING_CONCURRENCY } from "@/lib/rate-limit";

export interface RunMonitoringOptions {
  businessId: string;
  /** Limit to specific queries; defaults to all active queries for the business. */
  queryIds?: string[];
}

export interface RunMonitoringSummary {
  queriesRun: number;
  resultsCreated: number;
  platformsUsed: string[];
  demoPlatforms: string[];
  quotaExhausted: boolean;
  /** Set when the run was skipped entirely because it was requested too soon after the last one. */
  cooldownRemainingSeconds?: number;
}

/**
 * Runs every active traveller query for a business against every
 * configured AI platform connector, records one DiscoveryResult per
 * (query, platform) pair, and returns a summary. Never fabricates: each
 * stored result carries the platform's actual response text as evidence,
 * a timestamp, and a confidence score for the mention-detection heuristic.
 *
 * Cost control: real (non-demo) platform calls are capped by a rolling
 * daily quota per business, and every call — demo or real — runs through a
 * bounded concurrency pool so a large query list can't burst-hammer a
 * provider's API.
 */
export async function runMonitoring(options: RunMonitoringOptions): Promise<RunMonitoringSummary> {
  const cooldown = await checkPipelineCooldown(options.businessId);
  if (!cooldown.allowed) {
    return {
      queriesRun: 0,
      resultsCreated: 0,
      platformsUsed: [],
      demoPlatforms: [],
      quotaExhausted: false,
      cooldownRemainingSeconds: cooldown.retryAfterSeconds,
    };
  }
  await markPipelineRun(options.businessId);

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: options.businessId },
    include: { competitorLinks: true },
  });

  const queries = await prisma.travellerQuery.findMany({
    where: {
      businessId: options.businessId,
      active: true,
      ...(options.queryIds ? { id: { in: options.queryIds } } : {}),
    },
  });

  const connectors = getConnectors();
  const competitorNames = business.competitorLinks.map((c) => c.competitorName);
  const demoContext: DemoContext = {
    businessName: business.name,
    destination: business.destination,
    category: business.category,
    competitorNames,
  };

  let remainingQuota = await getRemainingMonitoringQuota(business.id);
  let quotaExhausted = false;
  const platformsUsed = new Set<string>();
  const demoPlatforms = new Set<string>();
  let resultsCreated = 0;

  const limit = pLimit(MONITORING_CONCURRENCY);
  const tasks: Promise<void>[] = [];

  for (const query of queries) {
    for (const connector of connectors) {
      const isReal = !(connector instanceof DemoConnector);

      tasks.push(
        limit(async () => {
          if (isReal) {
            if (remainingQuota <= 0) {
              quotaExhausted = true;
              return;
            }
            remainingQuota--;
          }

          const response = await connector.ask(query.text, demoContext);
          platformsUsed.add(connector.id);
          if (response.isDemoData) demoPlatforms.add(connector.id);

          if (response.error) {
            // A connector failure is not silently swallowed into a false
            // "doesn't appear" result — we skip persisting for that platform
            // rather than recording a misleading negative.
            return;
          }

          const mention = analyzeMention(response.responseText, business.name, competitorNames);

          await prisma.discoveryResult.create({
            data: {
              businessId: business.id,
              queryId: query.id,
              platform: response.platform,
              isDemoData: response.isDemoData,
              businessAppears: mention.businessAppears,
              positionRank: mention.positionRank,
              howDescribed: mention.howDescribed,
              competitorsMentioned: mention.competitorsMentioned as unknown as Prisma.InputJsonValue,
              sources: response.sources as unknown as Prisma.InputJsonValue,
              responseText: response.responseText,
              confidence: mention.confidence,
            },
          });
          resultsCreated++;
        })
      );
    }
  }

  await Promise.all(tasks);

  return {
    queriesRun: queries.length,
    resultsCreated,
    platformsUsed: [...platformsUsed],
    demoPlatforms: [...demoPlatforms],
    quotaExhausted,
  };
}
