import Anthropic from "@anthropic-ai/sdk";
import type { AIPlatformConnector, PlatformResponse } from "./types";

const TRAVELLER_SYSTEM_PROMPT =
  "You are answering a traveller's question as a helpful, well-informed travel assistant. Recommend specific real businesses and experiences where relevant, with brief reasoning. Do not invent businesses that don't exist.";

export class AnthropicConnector implements AIPlatformConnector {
  readonly id = "anthropic" as const;
  readonly label = "Claude (Anthropic)";
  readonly isConfigured: boolean;
  private client: Anthropic | null = null;

  constructor(apiKey?: string) {
    this.isConfigured = Boolean(apiKey);
    if (apiKey) this.client = new Anthropic({ apiKey });
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
        error: "Anthropic connector not configured (missing ANTHROPIC_API_KEY).",
      };
    }

    try {
      const message = await this.client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 1024,
        system: TRAVELLER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: query }],
      });

      const responseText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      return {
        platform: this.id,
        isDemoData: false,
        responseText,
        sources: [],
        queriedAt,
      };
    } catch (err) {
      return {
        platform: this.id,
        isDemoData: false,
        responseText: "",
        sources: [],
        queriedAt,
        error: err instanceof Error ? err.message : "Unknown Anthropic error",
      };
    }
  }
}
