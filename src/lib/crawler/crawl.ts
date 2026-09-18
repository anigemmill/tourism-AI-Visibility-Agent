import * as cheerio from "cheerio";

export interface CrawledPage {
  url: string;
  title: string;
  metaDescription: string | null;
  text: string;
  jsonLd: Record<string, unknown>[];
}

export interface CrawlResult {
  pages: CrawledPage[];
  errors: string[];
}

const RELEVANT_LINK_KEYWORDS = [
  "about",
  "faq",
  "faqs",
  "price",
  "pricing",
  "tour",
  "tours",
  "experience",
  "experiences",
  "activities",
  "book",
  "booking",
  "contact",
  "policy",
  "policies",
  "cancellation",
  "sustainab",
  "accessib",
  "award",
  "review",
  "hours",
  "location",
];

const MAX_PAGES = 8;
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

    return {
      page: { url: normalized, title, metaDescription, text: bodyText, jsonLd },
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
