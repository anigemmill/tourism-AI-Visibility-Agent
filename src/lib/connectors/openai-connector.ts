import OpenAI from "openai";
import type { AIPlatformConnector, PlatformResponse } from "./types";

const TRAVELLER_SYSTEM_PROMPT =
  "You are answering a traveller's question as a helpful, well-informed travel assistant. Recommend specific real businesses and experiences where relevant, with brief reasoning. Do not invent businesses that don't exist.";

export class OpenAIConnector implements AIPlatformConnector {
  readonly id = "openai" as const;
  readonly label = "ChatGPT (OpenAI)";
  readonly isConfigured: boolean;
  private client: OpenAI | null = null;

  constructor(apiKey?: string) {
    this.isConfigured = Boolean(apiKey);
    if (apiKey) this.client = new OpenAI({ apiKey });
  }

  async ask(query: string): Promise<PlatformResponse> {
    const queriedAt = new Date().toISOString();
    if (!this.client) {
      return {
        platform: this.id,
        isDemoData: false,
        responseText: "",
        sources: [],
        queriedAt,
        error: "OpenAI connector not configured (missing OPENAI_API_KEY).",
      };
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: TRAVELLER_SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        temperature: 0.4,
      });

      const responseText = completion.choices[0]?.message?.content ?? "";
      return {
        platform: this.id,
        isDemoData: false,
        responseText,
        sources: [], // Chat Completions does not return browsing citations
        queriedAt,
      };
    } catch (err) {
      return {
        platform: this.id,
        isDemoData: false,
        responseText: "",
        sources: [],
        queriedAt,
        error: err instanceof Error ? err.message : "Unknown OpenAI error",
      };
    }
  }
}
