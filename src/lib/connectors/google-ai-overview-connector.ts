import type { AIPlatformConnector, PlatformResponse, PlatformSource } from "./types";

interface SerpApiAiOverviewSource {
  title?: string;
  link?: string;
}
interface SerpApiAiOverviewBlock {
  text?: string;
  snippet?: string;
  references?: SerpApiAiOverviewSource[];
}
interface SerpApiResponseBody {
  ai_overview?: {
    text_blocks?: SerpApiAiOverviewBlock[];
    references?: SerpApiAiOverviewSource[];
  };
  organic_results?: { title?: string; link?: string; snippet?: string }[];
  error?: string;
}

/**
 * Google does not expose AI Overview / AI Mode as a direct API, so this
 * connector goes through SerpApi (https://serpapi.com), a third-party SERP
 * scraper that surfaces the AI Overview panel plus organic results. If the
 * AI Overview panel is absent for a query (Google doesn't always show one),
 * we fall back to reporting the top organic results as the visible "search
 * visibility" surface instead of fabricating an AI answer.
 */
export class GoogleAiOverviewConnector implements AIPlatformConnector {
  readonly id = "google_ai_overview" as const;
  readonly label = "Google AI Overview";
  readonly isConfigured: boolean;

  constructor(private apiKey?: string) {
    this.isConfigured = Boolean(apiKey);
  }

  async ask(query: string): Promise<PlatformResponse> {
    const queriedAt = new Date().toISOString();
    if (!this.apiKey) {
      return {
        platform: this.id,
        isDemoData: false,
        responseText: "",
        sources: [],
        queriedAt,
        error: "Google AI Overview connector not configured (missing SERPAPI_API_KEY).",
      };
    }

    try {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google");
      url.searchParams.set("q", query);
      url.searchParams.set("api_key", this.apiKey);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = await res.text();
        return {
          platform: this.id,
          isDemoData: false,
          responseText: "",
          sources: [],
          queriedAt,
          error: `SerpApi error ${res.status}: ${body.slice(0, 300)}`,
        };
      }

      const data = (await res.json()) as SerpApiResponseBody;

      if (data.ai_overview?.text_blocks?.length) {
        const responseText = data.ai_overview.text_blocks
          .map((b) => b.text || b.snippet || "")
          .filter(Boolean)
          .join("\n");
        const sources: PlatformSource[] = (data.ai_overview.references ?? []).map((r) => ({
          title: r.title ?? r.link ?? "Source",
          url: r.link ?? "",
        }));
        return { platform: this.id, isDemoData: false, responseText, sources, queriedAt };
      }

      // No AI Overview panel returned for this query — report organic results
      // instead of pretending there was an AI answer.
      const organic = data.organic_results ?? [];
      const responseText = organic.length
        ? `No AI Overview panel was shown for this query. Top organic results:\n${organic
            .slice(0, 5)
            .map((r, i) => `${i + 1}. ${r.title} — ${r.snippet ?? ""}`)
            .join("\n")}`
        : "No AI Overview panel or organic results were returned for this query.";
      const sources: PlatformSource[] = organic
        .slice(0, 5)
        .map((r) => ({ title: r.title ?? r.link ?? "Source", url: r.link ?? "" }));

      return { platform: this.id, isDemoData: false, responseText, sources, queriedAt };
    } catch (err) {
      return {
        platform: this.id,
        isDemoData: false,
        responseText: "",
        sources: [],
        queriedAt,
        error: err instanceof Error ? err.message : "Unknown SerpApi error",
      };
    }
  }
}
