import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

export interface GeneratedContentDraft {
  kind: "faq" | "meta_description" | "structured_data" | "page_draft" | "social_post" | "internal_link";
  title?: string;
  body: string;
}

/**
 * Drafts ready-to-use content for a content opportunity: an FAQ answer, a
 * meta description, a JSON-LD structured-data snippet, and a short social
 * post. Uses an LLM (Anthropic, if configured) to draft copy grounded in
 * the business's own knowledge profile; falls back to straightforward
 * templates when no key is configured so the feature still works. Every
 * draft is marked for human review before publishing — this generates a
 * starting point, not a fact.
 */
export async function generateContentForOpportunity(opportunityId: string): Promise<GeneratedContentDraft[]> {
  const opportunity = await prisma.contentOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: { business: { include: { differentiators: true, locations: true } } },
  });

  const apiKey = process.env.CONTENT_LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const llmDrafts = await tryLlmGenerate(opportunity, apiKey);
    if (llmDrafts) return llmDrafts;
  }

  return templateGenerate(opportunity);
}

interface OpportunityWithBusiness {
  id: string;
  title: string;
  type: string;
  relatedQuery: string | null;
  rationale: string;
  business: {
    name: string;
    destination: string;
    category: string;
    bookingUrl: string | null;
    differentiators: { statement: string }[];
    locations: { address: string | null; region: string | null }[];
  };
}

async function tryLlmGenerate(
  opportunity: OpportunityWithBusiness,
  apiKey: string
): Promise<GeneratedContentDraft[] | null> {
  const client = new Anthropic({ apiKey });
  const differentiators = opportunity.business.differentiators.map((d) => d.statement).join("; ") || "none on record";

  try {
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `Draft website content for "${opportunity.business.name}", a ${opportunity.business.category} business in ${opportunity.business.destination}.
Content opportunity: ${opportunity.title}
Traveller question this should answer: ${opportunity.relatedQuery ?? "n/a"}
Known differentiators: ${differentiators}

Write, in this exact order and clearly labeled with these exact headers, plain text (no markdown formatting inside sections other than the headers):
### FAQ
Q: <a natural question>
A: <a 2-4 sentence answer>

### META_DESCRIPTION
<a single meta description under 160 characters>

### STRUCTURED_DATA
<a valid JSON-LD FAQPage or Product snippet as compact JSON>

### SOCIAL_POST
<a short, upbeat social caption under 280 characters>

Only state facts consistent with the differentiators given. Do not invent prices, awards, or statistics.`,
        },
      ],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return parseLlmSections(text);
  } catch {
    return null;
  }
}

function parseLlmSections(text: string): GeneratedContentDraft[] | null {
  const sections: GeneratedContentDraft[] = [];
  const faq = text.match(/###\s*FAQ\s*([\s\S]*?)(?=###|$)/i)?.[1]?.trim();
  const meta = text.match(/###\s*META_DESCRIPTION\s*([\s\S]*?)(?=###|$)/i)?.[1]?.trim();
  const structured = text.match(/###\s*STRUCTURED_DATA\s*([\s\S]*?)(?=###|$)/i)?.[1]?.trim();
  const social = text.match(/###\s*SOCIAL_POST\s*([\s\S]*?)(?=###|$)/i)?.[1]?.trim();

  if (faq) sections.push({ kind: "faq", body: faq });
  if (meta) sections.push({ kind: "meta_description", body: meta });
  if (structured) sections.push({ kind: "structured_data", body: structured });
  if (social) sections.push({ kind: "social_post", body: social });

  return sections.length ? sections : null;
}

function templateGenerate(opportunity: OpportunityWithBusiness): GeneratedContentDraft[] {
  const { business } = opportunity;
  const question = opportunity.relatedQuery ?? opportunity.title;
  const differentiator = business.differentiators[0]?.statement;

  const faqBody = `Q: ${question}\nA: ${business.name} offers ${business.category.toLowerCase()} experiences in ${business.destination}.${
    differentiator ? ` ${differentiator}.` : ""
  } ${business.bookingUrl ? `Book directly at ${business.bookingUrl}.` : "Contact us directly to book."}`;

  const metaDescription = `${business.name} — ${business.category} in ${business.destination}.${
    differentiator ? ` ${differentiator}.` : ""
  }`.slice(0, 158);

  const structuredData = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: faqBody.replace(/^Q:.*\nA:\s*/, "") },
        },
      ],
    },
    null,
    2
  );

  const socialPost = `Planning ${business.category.toLowerCase()} in ${business.destination}? ${business.name} has you covered.${
    business.bookingUrl ? ` Book now: ${business.bookingUrl}` : ""
  }`.slice(0, 279);

  return [
    { kind: "faq", body: faqBody },
    { kind: "meta_description", body: metaDescription },
    { kind: "structured_data", body: structuredData },
    { kind: "social_post", body: socialPost },
  ];
}

export async function saveGeneratedContent(
  businessId: string,
  opportunityId: string | null,
  drafts: GeneratedContentDraft[]
) {
  await prisma.generatedContent.createMany({
    data: drafts.map((d) => ({
      businessId,
      opportunityId,
      kind: d.kind,
      title: d.title,
      body: d.body,
      isAiGenerated: true,
    })),
  });
}
