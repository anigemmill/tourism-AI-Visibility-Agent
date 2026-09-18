import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { crawlBusinessWebsite } from "./crawl";
import { heuristicExtract, llmAssistedExtract, mergeDrafts } from "./extract-profile";

export interface CrawlAndPersistResult {
  pagesCrawled: number;
  extractionMethod?: "heuristic" | "llm_assisted";
  errors: string[];
  created: {
    faqs: number;
    products: number;
    experiences: number;
    policies: number;
    locations: number;
    credentials: number;
    differentiators: number;
  };
}

/**
 * Crawls a business's website, extracts a knowledge profile draft, and
 * persists new (non-duplicate) records plus a CrawlSnapshot. Shared by the
 * manual "re-crawl" API route and the full onboarding pipeline so both stay
 * in sync with a single implementation.
 */
export async function crawlAndPersist(businessId: string): Promise<CrawlAndPersistResult> {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const crawl = await crawlBusinessWebsite(business.website);

  if (crawl.pages.length === 0) {
    await prisma.crawlSnapshot.create({
      data: { businessId, status: "failed", pagesCrawled: 0, errors: crawl.errors as unknown as Prisma.InputJsonValue },
    });
    return {
      pagesCrawled: 0,
      errors: crawl.errors,
      created: { faqs: 0, products: 0, experiences: 0, policies: 0, locations: 0, credentials: 0, differentiators: 0 },
    };
  }

  let draft = heuristicExtract(crawl.pages);
  const apiKey = process.env.CONTENT_LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const llmDraft = await llmAssistedExtract(crawl.pages, apiKey);
    draft = mergeDrafts(draft, llmDraft);
  }

  const [existingFaqs, existingProducts, existingExperiences, existingPolicies, existingCredentials, existingDifferentiators] =
    await Promise.all([
      prisma.faq.findMany({ where: { businessId }, select: { question: true } }),
      prisma.product.findMany({ where: { businessId }, select: { name: true } }),
      prisma.experience.findMany({ where: { businessId }, select: { name: true } }),
      prisma.policy.findMany({ where: { businessId }, select: { summary: true } }),
      prisma.credential.findMany({ where: { businessId }, select: { name: true } }),
      prisma.differentiator.findMany({ where: { businessId }, select: { statement: true } }),
    ]);

  const seenFaq = new Set(existingFaqs.map((f) => f.question.toLowerCase()));
  const seenProduct = new Set(existingProducts.map((p) => p.name.toLowerCase()));
  const seenExperience = new Set(existingExperiences.map((e) => e.name.toLowerCase()));
  const seenPolicy = new Set(existingPolicies.map((p) => p.summary.toLowerCase()));
  const seenCredential = new Set(existingCredentials.map((c) => c.name.toLowerCase()));
  const seenDifferentiator = new Set(existingDifferentiators.map((d) => d.statement.toLowerCase()));

  const newFaqs = draft.faqs.filter((f) => !seenFaq.has(f.question.toLowerCase()));
  const newProducts = draft.products.filter((p) => !seenProduct.has(p.name.toLowerCase()));
  const newExperiences = draft.experiences.filter((e) => !seenExperience.has(e.name.toLowerCase()));
  const newPolicies = draft.policies.filter((p) => !seenPolicy.has(p.summary.toLowerCase()));
  const newCredentials = draft.credentials.filter((c) => !seenCredential.has(c.name.toLowerCase()));
  const newDifferentiators = draft.differentiators.filter((d) => !seenDifferentiator.has(d.statement.toLowerCase()));

  await prisma.$transaction([
    ...(newFaqs.length ? [prisma.faq.createMany({ data: newFaqs.map((f) => ({ businessId, ...f })) })] : []),
    ...(newProducts.length ? [prisma.product.createMany({ data: newProducts.map((p) => ({ businessId, ...p })) })] : []),
    ...(newExperiences.length
      ? [prisma.experience.createMany({ data: newExperiences.map((e) => ({ businessId, ...e })) })]
      : []),
    ...(newPolicies.length ? [prisma.policy.createMany({ data: newPolicies.map((p) => ({ businessId, ...p })) })] : []),
    ...(draft.locations.length
      ? [
          prisma.businessLocation.createMany({
            data: draft.locations.map((l) => ({
              businessId,
              ...l,
              openingHours: (l.openingHours ?? undefined) as Prisma.InputJsonValue | undefined,
            })),
          }),
        ]
      : []),
    ...(newCredentials.length
      ? [prisma.credential.createMany({ data: newCredentials.map((c) => ({ businessId, ...c })) })]
      : []),
    ...(newDifferentiators.length
      ? [prisma.differentiator.createMany({ data: newDifferentiators.map((d) => ({ businessId, ...d })) })]
      : []),
    ...(!business.description && draft.description
      ? [prisma.business.update({ where: { id: businessId }, data: { description: draft.description } })]
      : []),
  ]);

  await prisma.crawlSnapshot.create({
    data: {
      businessId,
      status: crawl.errors.length > 0 ? "partial" : "success",
      pagesCrawled: crawl.pages.length,
      errors: crawl.errors as unknown as Prisma.InputJsonValue,
      rawExtract: draft as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    pagesCrawled: crawl.pages.length,
    extractionMethod: draft.extractionMethod,
    errors: crawl.errors,
    created: {
      faqs: newFaqs.length,
      products: newProducts.length,
      experiences: newExperiences.length,
      policies: newPolicies.length,
      locations: draft.locations.length,
      credentials: newCredentials.length,
      differentiators: newDifferentiators.length,
    },
  };
}
