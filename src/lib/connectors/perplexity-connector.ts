import type { AIPlatformConnector, PlatformResponse, PlatformSource } from "./types";

const TRAVELLER_SYSTEM_PROMPT =
  "You are answering a traveller's question as a helpful, well-informed travel assistant. Recommend specific real businesses and experiences where relevant, with brief reasoning.";

interface PerplexityChoice {
  message?: { content?: string };
}
interface PerplexityCitation {
  title?: string;
  url?: string;
}
interface PerplexityResponseBody {
  choices?: PerplexityChoice[];
  citations?: (string | PerplexityCitation)[];
}

/**
 * Perplexity's chat-completions-compatible API. Perplexity answers are
 * search-grounded, so its `citations` field gives us real third-party
 * sources — useful signal for the fact-checker and authority scoring.
 */
export class PerplexityConnector implements AIPlatformConnector {
  readonly id = "perplexity" as const;
  readonly label = "Perplexity";
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
        error: "Perplexity connector not configured (missing PERPLEXITY_API_KEY).",
      };
    }

    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.PERPLEXITY_MODEL || "sonar",
          messages: [
            { role: "system", content: TRAVELLER_SYSTEM_PROMPT },
            { role: "user", content: query },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        return {
          platform: this.id,
          isDemoData: false,
          responseText: "",
          sources: [],
          queriedAt,
          error: `Perplexity API error ${res.status}: ${body.slice(0, 300)}`,
        };
      }

      const data = (await res.json()) as PerplexityResponseBody;
      const responseText = data.choices?.[0]?.message?.content ?? "";
      const sources: PlatformSource[] = (data.citations ?? []).map((c) =>
        typeof c === "string" ? { title: c, url: c } : { title: c.title ?? c.url ?? "Source", url: c.url ?? "" }
      );

      return {
        platform: this.id,
        isDemoData: false,
        responseText,
        sources,
        queriedAt,
      };
    } catch (err) {
      return {
        platform: this.id,
        isDemoData: false,
        responseText: "",
        sources: [],
        queriedAt,
        error: err instanceof Error ? err.message : "Unknown Perplexity error",
      };
    }
  }
}
