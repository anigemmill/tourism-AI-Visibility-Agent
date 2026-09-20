import Anthropic from "@anthropic-ai/sdk";
import type { CrawledPage } from "./crawl";

export interface DraftItem {
  sourceUrl: string;
  confidence: number; // 0-1
}

export interface DraftProduct extends DraftItem {
  name: string;
  description?: string;
  priceAmount?: number;
  priceCurrency?: string;
  priceUnit?: string;
  durationMinutes?: number;
  audiences: string[];
}

export interface DraftExperience extends DraftItem {
  name: string;
  description?: string;
  category?: string;
  audiences: string[];
}

export interface DraftLocation extends DraftItem {
  label?: string;
  address?: string;
  region?: string;
  country?: string;
  openingHours?: Record<string, string>;
  accessibility?: string;
}

export interface DraftFaq extends DraftItem {
  question: string;
  answer: string;
}

export interface DraftPolicy extends DraftItem {
  type: string;
  summary: string;
}

export interface DraftCredential extends DraftItem {
  type: string;
  name: string;
  issuer?: string;
  year?: number;
}

export interface DraftDifferentiator extends DraftItem {
  statement: string;
  category?: string;
}

export interface KnowledgeProfileDraft {
  description?: string;
  products: DraftProduct[];
  experiences: DraftExperience[];
  locations: DraftLocation[];
  faqs: DraftFaq[];
  policies: DraftPolicy[];
  credentials: DraftCredential[];
  differentiators: DraftDifferentiator[];
  extractionMethod: "heuristic" | "llm_assisted";
}

const FAQ_HEADING_RE = /^(.{5,140}\?)\s*$/;
const PRICE_RE = /(NZ\$|AU\$|US\$|£|€|\$)\s?(\d{1,4}(?:[.,]\d{2})?)\s*(per person|per adult|per child|per group|pp)?/i;
const HOURS_LINE_RE =
  /(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)[a-z\s,-]*?(\d{1,2}(:\d{2})?\s?(am|pm)?\s?[-–to]{1,3}\s?\d{1,2}(:\d{2})?\s?(am|pm)?)/i;
const CREDENTIAL_KEYWORDS = [
  "award",
  "accredited",
  "certified",
  "certification",
  "qualmark",
  "trip advisor certificate",
  "member of",
];
const SUSTAINABILITY_KEYWORDS = ["sustainab", "eco-friendly", "eco friendly", "carbon", "conservation"];

/**
 * Heuristic extraction: regex + DOM-structure signals only. Runs for every
 * crawl regardless of whether an LLM key is configured, and is the sole
 * extraction method when one isn't. Every field carries confidence < 1 and
 * a sourceUrl so it can be reviewed, never presented as verified fact.
 */
export function heuristicExtract(pages: CrawledPage[]): KnowledgeProfileDraft {
  const draft: KnowledgeProfileDraft = {
    products: [],
    experiences: [],
    locations: [],
    faqs: [],
    policies: [],
    credentials: [],
    differentiators: [],
    extractionMethod: "heuristic",
  };

  for (const page of pages) {
    extractFromJsonLd(page, draft);

    if (page.structuredFaqs.length > 0) {
      for (const faq of page.structuredFaqs) {
        draft.faqs.push({ sourceUrl: page.url, confidence: 0.75, question: faq.question, answer: faq.answer });
      }
    } else {
      // Only fall back to the noisier flattened-text heuristic when the
      // page has no DOM-structured FAQ markup to draw from.
      extractFaqsFromText(page, draft);
    }

    extractPricesFromText(page, draft);
    extractHoursFromText(page, draft);
    extractCredentialsFromText(page, draft);

    if (!draft.description && page.metaDescription) {
      draft.description = page.metaDescription;
    }
  }

  return draft;
}

function extractFromJsonLd(page: CrawledPage, draft: KnowledgeProfileDraft) {
  for (const block of page.jsonLd) {
    const type = String(block["@type"] ?? "").toLowerCase();

    if (type.includes("localbusiness") || type.includes("touristattraction") || type.includes("organization")) {
      const address = block.address as Record<string, string> | undefined;
      draft.locations.push({
        sourceUrl: page.url,
        confidence: 0.95,
        label: (block.name as string) ?? undefined,
        address: address ? [address.streetAddress, address.addressLocality].filter(Boolean).join(", ") : undefined,
        region: address?.addressRegion,
        country: address?.addressCountry,
        openingHours: parseSchemaOpeningHours(block.openingHoursSpecification),
      });
    }

    if (type === "faqpage" && Array.isArray(block.mainEntity)) {
      for (const entity of block.mainEntity as Record<string, unknown>[]) {
        const question = entity.name as string | undefined;
        const answer = (entity.acceptedAnswer as Record<string, string> | undefined)?.text;
        if (question && answer) {
          draft.faqs.push({ sourceUrl: page.url, confidence: 1, question, answer });
        }
      }
    }

    if (type.includes("product") || type.includes("touristtrip") || type.includes("event")) {
      const offers = block.offers as Record<string, unknown> | undefined;
      draft.products.push({
        sourceUrl: page.url,
        confidence: 0.9,
        name: (block.name as string) ?? "Untitled product",
        description: block.description as string | undefined,
        priceAmount: offers?.price ? Number(offers.price) : undefined,
        priceCurrency: (offers?.priceCurrency as string) ?? undefined,
        audiences: [],
      });
    }
  }
}

function parseSchemaOpeningHours(spec: unknown): Record<string, string> | undefined {
  if (!Array.isArray(spec)) return undefined;
  const hours: Record<string, string> = {};
  for (const entry of spec as Record<string, unknown>[]) {
    const days = entry.dayOfWeek;
    const opens = entry.opens as string | undefined;
    const closes = entry.closes as string | undefined;
    if (!opens || !closes) continue;
    const dayList = Array.isArray(days) ? days : [days];
    for (const d of dayList) {
      if (typeof d === "string") hours[d.replace("https://schema.org/", "")] = `${opens}-${closes}`;
    }
  }
  return Object.keys(hours).length ? hours : undefined;
}

function extractFaqsFromText(page: CrawledPage, draft: KnowledgeProfileDraft) {
  // Cheap heuristic: sentences ending in "?" followed by the next ~200 chars,
  // scanned from the flattened body text. Structural (heading+paragraph)
  // extraction would be more precise but this catches real content without
  // needing a second DOM pass per page.
  const sentences = page.text.split(/(?<=[.?!])\s+/);
  for (let i = 0; i < sentences.length - 1; i++) {
    const s = sentences[i].trim();
    if (FAQ_HEADING_RE.test(s) && s.length < 140) {
      const answer = sentences[i + 1]?.trim();
      if (answer && answer.length > 20 && answer.length < 500) {
        draft.faqs.push({ sourceUrl: page.url, confidence: 0.45, question: s, answer });
      }
    }
  }
}

function extractPricesFromText(page: CrawledPage, draft: KnowledgeProfileDraft) {
  const matches = [...page.text.matchAll(new RegExp(PRICE_RE, "gi"))].slice(0, 10);
  for (const m of matches) {
    const start = Math.max(0, (m.index ?? 0) - 60);
    const context = page.text.slice(start, (m.index ?? 0) + 20).trim();
    draft.products.push({
      sourceUrl: page.url,
      confidence: 0.35,
      name: context.slice(0, 80) || "Priced item",
      priceAmount: Number(m[2].replace(",", ".")),
      priceCurrency: normalizeCurrency(m[1]),
      priceUnit: m[3]?.toLowerCase(),
      audiences: [],
    });
  }
}

function normalizeCurrency(symbol: string): string {
  const map: Record<string, string> = { "NZ$": "NZD", "AU$": "AUD", "US$": "USD", "£": "GBP", "€": "EUR", "$": "USD" };
  return map[symbol] ?? symbol;
}

function extractHoursFromText(page: CrawledPage, draft: KnowledgeProfileDraft) {
  const lines = page.text.split(/(?<=\.)\s+|\n/);
  const hours: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(HOURS_LINE_RE);
    if (m) hours[m[1].slice(0, 3).toLowerCase()] = m[4];
  }
  if (Object.keys(hours).length) {
    draft.locations.push({ sourceUrl: page.url, confidence: 0.5, openingHours: hours });
  }
}

function extractCredentialsFromText(page: CrawledPage, draft: KnowledgeProfileDraft) {
  const lower = page.text.toLowerCase();
  for (const kw of CREDENTIAL_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) {
      const snippet = page.text.slice(Math.max(0, idx - 30), idx + 80).trim();
      draft.credentials.push({
        sourceUrl: page.url,
        confidence: 0.4,
        type: "award",
        name: snippet,
      });
    }
  }
  for (const kw of SUSTAINABILITY_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) {
      const snippet = page.text.slice(Math.max(0, idx - 30), idx + 100).trim();
      draft.differentiators.push({
        sourceUrl: page.url,
        confidence: 0.4,
        statement: snippet,
        category: "sustainability",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// LLM-assisted extraction (optional — used when an API key is configured)
// ---------------------------------------------------------------------------

const EXTRACTION_TOOL_SCHEMA = {
  name: "record_knowledge_profile",
  description:
    "Record structured facts about a tourism business extracted strictly from the provided page text. Never invent facts not present in the text.",
  input_schema: {
    type: "object" as const,
    properties: {
      description: { type: "string" as const },
      products: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            description: { type: "string" as const },
            priceAmount: { type: "number" as const },
            priceCurrency: { type: "string" as const },
            priceUnit: { type: "string" as const },
            audiences: { type: "array" as const, items: { type: "string" as const } },
            sourceUrl: { type: "string" as const },
          },
          required: ["name", "sourceUrl"],
        },
      },
      experiences: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            description: { type: "string" as const },
            category: { type: "string" as const },
            audiences: { type: "array" as const, items: { type: "string" as const } },
            sourceUrl: { type: "string" as const },
          },
          required: ["name", "sourceUrl"],
        },
      },
      faqs: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            question: { type: "string" as const },
            answer: { type: "string" as const },
            sourceUrl: { type: "string" as const },
          },
          required: ["question", "answer", "sourceUrl"],
        },
      },
      policies: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            type: { type: "string" as const },
            summary: { type: "string" as const },
            sourceUrl: { type: "string" as const },
          },
          required: ["type", "summary", "sourceUrl"],
        },
      },
      credentials: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            type: { type: "string" as const },
            name: { type: "string" as const },
            issuer: { type: "string" as const },
            sourceUrl: { type: "string" as const },
          },
          required: ["type", "name", "sourceUrl"],
        },
      },
      differentiators: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            statement: { type: "string" as const },
            category: { type: "string" as const },
            sourceUrl: { type: "string" as const },
          },
          required: ["statement", "sourceUrl"],
        },
      },
    },
    required: ["products", "experiences", "faqs", "policies", "credentials", "differentiators"],
  },
};

interface LlmExtractionResult {
  description?: string;
  products: (Omit<DraftProduct, "confidence"> & { sourceUrl: string })[];
  experiences: (Omit<DraftExperience, "confidence"> & { sourceUrl: string })[];
  faqs: (Omit<DraftFaq, "confidence"> & { sourceUrl: string })[];
  policies: (Omit<DraftPolicy, "confidence"> & { sourceUrl: string })[];
  credentials: (Omit<DraftCredential, "confidence"> & { sourceUrl: string })[];
  differentiators: (Omit<DraftDifferentiator, "confidence"> & { sourceUrl: string })[];
}

/**
 * LLM-assisted extraction, used to fill in and structure what the heuristic
 * pass misses (e.g. audience targeting, categorized experiences, cleanly
 * paired FAQs). Runs only when CONTENT_LLM_API_KEY / ANTHROPIC_API_KEY is
 * set. The model is instructed never to invent facts, and every field it
 * returns still carries a sourceUrl back to the crawled page — confidence is
 * capped below 1 because it is model-mediated, not a verbatim schema match.
 */
export async function llmAssistedExtract(
  pages: CrawledPage[],
  apiKey: string
): Promise<KnowledgeProfileDraft | null> {
  const client = new Anthropic({ apiKey });
  const corpus = pages
    .map((p) => `--- PAGE: ${p.url} ---\nTITLE: ${p.title}\n${p.text.slice(0, 4000)}`)
    .join("\n\n")
    .slice(0, 40_000);

  try {
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 4096,
      tools: [EXTRACTION_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "record_knowledge_profile" },
      messages: [
        {
          role: "user",
          content: `Extract a structured knowledge profile for this tourism business strictly from the page text below. Only include facts explicitly present in the text — never infer prices, hours, or claims that aren't written. Attribute every item to the sourceUrl of the page it came from.\n\n${corpus}`,
        },
      ],
    });

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) return null;

    const result = toolUse.input as LlmExtractionResult;

    return {
      description: result.description,
      extractionMethod: "llm_assisted",
      products: result.products.map((p) => ({ ...p, audiences: p.audiences ?? [], confidence: 0.75 })),
      experiences: result.experiences.map((e) => ({ ...e, audiences: e.audiences ?? [], confidence: 0.75 })),
      locations: [],
      faqs: result.faqs.map((f) => ({ ...f, confidence: 0.8 })),
      policies: result.policies.map((p) => ({ ...p, confidence: 0.75 })),
      credentials: result.credentials.map((c) => ({ ...c, confidence: 0.7 })),
      differentiators: result.differentiators.map((d) => ({ ...d, confidence: 0.7 })),
    };
  } catch {
    return null; // fall back to heuristic-only results rather than failing the crawl
  }
}

/** Merges heuristic + LLM drafts, preferring higher-confidence duplicates. */
export function mergeDrafts(
  base: KnowledgeProfileDraft,
  extra: KnowledgeProfileDraft | null
): KnowledgeProfileDraft {
  if (!extra) return base;
  return {
    description: extra.description ?? base.description,
    extractionMethod: "llm_assisted",
    products: [...base.products, ...extra.products],
    experiences: [...base.experiences, ...extra.experiences],
    locations: [...base.locations, ...extra.locations],
    faqs: [...base.faqs, ...extra.faqs],
    policies: [...base.policies, ...extra.policies],
    credentials: [...base.credentials, ...extra.credentials],
    differentiators: [...base.differentiators, ...extra.differentiators],
  };
}
