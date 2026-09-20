import * as cheerio from "cheerio";

export interface StructuredFaq {
  question: string;
  answer: string;
}

export interface CrawledPage {
  url: string;
  title: string;
  metaDescription: string | null;
  text: string;
  jsonLd: Record<string, unknown>[];
  /**
   * FAQ-shaped Q&A pairs found from DOM structure (definition lists, or a
   * heading ending in "?" followed by its answer) rather than from
   * sentence-splitting flattened text. Much higher precision, so the
   * extractor treats these with higher confidence than the text heuristic.
   */
  structuredFaqs: StructuredFaq[];
}

export interface CrawlResult {
  pages: CrawledPage[];
  errors: string[];
}

const RELEVANT_LINK_KEYWORDS = [
  "about",
  "faq",
  "faqs",
  "help",
  "support",
  "price",
  "pricing",
  "rates",
  "tour",
  "tours",
  "experience",
  "experiences",
  "activities",
  "things-to-do",
  "book",
  "booking",
  "reserve",
  "contact",
  "policy",
  "policies",
  "terms",
  "cancellation",
  "refund",
  "sustainab",
  "eco",
  "conservation",
  "accessib",
  "award",
  "review",
  "testimonial",
  "hours",
  "location",
  "visit",
  "plan-your-trip",
  "itinerary",
];

const MAX_PAGES = 12;
const FETCH_TIMEOUT_MS = 10_000;

export async function crawlBusinessWebsite(startUrl: string): Promise<CrawlResult> {
  const errors: string[] = [];
  const pages: CrawledPage[] = [];
  const origin = safeOrigin(startUrl);
  if (!origin) {
    return { pages, errors: [`"${startUrl}" is not a valid URL.`] };
  }

  const homepage = await fetchPage(startUrl);
  if (!homepage.page) {
    return { pages, errors: [homepage.error ?? `Could not fetch ${startUrl}`] };
  }
  pages.push(homepage.page);

  const candidateLinks = extractRelevantLinks(homepage.html ?? "", origin, startUrl);

  for (const link of candidateLinks.slice(0, MAX_PAGES - 1)) {
    const result = await fetchPage(link);
    if (result.page) pages.push(result.page);
    else if (result.error) errors.push(result.error);
  }

  return { pages, errors };
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    try {
      return new URL(`https://${url}`).origin;
    } catch {
      return null;
    }
  }
}

async function fetchPage(
  url: string
): Promise<{ page: CrawledPage | null; html?: string; error?: string }> {
  const normalized = url.startsWith("http") ? url : `https://${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(normalized, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TourismAIVisibilityAgent/1.0; +https://example.com/bot)",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { page: null, error: `${normalized} responded with HTTP ${res.status}` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return { page: null, error: `${normalized} is not HTML (${contentType})` };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, noscript, svg").remove();

    const title = $("title").first().text().trim();
    const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? null;

    const bodyText = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20_000);

    const jsonLd: Record<string, unknown>[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).text());
        if (Array.isArray(parsed)) jsonLd.push(...parsed);
        else jsonLd.push(parsed);
      } catch {
        // malformed JSON-LD — skip rather than guess
      }
    });

    const structuredFaqs = extractStructuredFaqs($);

    return {
      page: { url: normalized, title, metaDescription, text: bodyText, jsonLd, structuredFaqs },
      html,
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      page: null,
      error: `Failed to fetch ${normalized}: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

const MAX_STRUCTURED_FAQS_PER_PAGE = 25;
const MIN_ANSWER_LENGTH = 15;
const MAX_ANSWER_LENGTH = 600;

/**
 * Pulls FAQ-shaped Q&A pairs directly from DOM structure — far more
 * reliable than sentence-splitting flattened text, since it doesn't
 * misfire on unrelated sentences that happen to end in "?". Handles the
 * three shapes real sites actually use: <dl>/<dt>/<dd> definition lists,
 * <details>/<summary> accordions, and a heading ending in "?" followed by
 * its answer paragraph.
 */
export function extractStructuredFaqs($: cheerio.CheerioAPI): StructuredFaq[] {
  const faqs: StructuredFaq[] = [];
  const push = (question: string, answer: string) => {
    const q = question.replace(/\s+/g, " ").trim();
    const a = answer.replace(/\s+/g, " ").trim();
    if (faqs.length >= MAX_STRUCTURED_FAQS_PER_PAGE) return;
    if (!q || a.length < MIN_ANSWER_LENGTH) return;
    faqs.push({ question: q, answer: a.slice(0, MAX_ANSWER_LENGTH) });
  };

  // <dl><dt>Question</dt><dd>Answer</dd></dl>
  $("dl").each((_, dl) => {
    const dts = $(dl).find("dt");
    dts.each((_, dt) => {
      const question = $(dt).text();
      if (!question.trim()) return;
      const answer = $(dt).nextAll("dd").first().text();
      push(question, answer);
    });
  });

  // <details><summary>Question</summary>Answer</details> — the standard
  // native accordion markup most FAQ sections are built with.
  $("details").each((_, details) => {
    const summary = $(details).find("summary").first();
    const question = summary.text();
    if (!question.trim()) return;
    const answer = $(details).clone().children("summary").remove().end().text();
    push(question, answer);
  });

  // Heading ending in "?" followed by its answer content.
  $("h2, h3, h4, h5").each((_, heading) => {
    const question = $(heading).text();
    if (!question.trim().endsWith("?")) return;
    const answer = $(heading).nextUntil("h2, h3, h4, h5").text();
    push(question, answer);
  });

  return faqs;
}

function extractRelevantLinks(html: string, origin: string, startUrl: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>([normalizePath(startUrl)]);
  const scored: { url: string; score: number }[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let absolute: string;
    try {
      absolute = new URL(href, origin).toString();
    } catch {
      return;
    }
    if (!absolute.startsWith(origin)) return; // internal links only
    const path = normalizePath(absolute);
    if (seen.has(path)) return;
    seen.add(path);

    const haystack = `${path} ${$(el).text()}`.toLowerCase();
    const score = RELEVANT_LINK_KEYWORDS.reduce(
      (acc, kw) => (haystack.includes(kw) ? acc + 1 : acc),
      0
    );
    if (score > 0) scored.push({ url: absolute, score });
  });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.url);
}

function normalizePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}
