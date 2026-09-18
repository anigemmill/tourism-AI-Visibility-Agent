import type { AIPlatformConnector, PlatformId } from "./types";
import { DemoConnector } from "./demo-connector";
import { OpenAIConnector } from "./openai-connector";
import { AnthropicConnector } from "./anthropic-connector";
import { PerplexityConnector } from "./perplexity-connector";
import { GoogleAiOverviewConnector } from "./google-ai-overview-connector";

const PLATFORM_LABELS: Record<PlatformId, string> = {
  openai: "ChatGPT (OpenAI)",
  anthropic: "Claude (Anthropic)",
  perplexity: "Perplexity",
  google_ai_overview: "Google AI Overview",
  demo: "Demo",
};

/**
 * Builds the active set of AI platform connectors for this deployment.
 * Any platform with a configured API key runs live; any platform without
 * one is swapped for the demo connector so the pipeline still produces a
 * result — always clearly labeled `isDemoData: true`.
 */
export function getConnectors(): AIPlatformConnector[] {
  const openai = new OpenAIConnector(process.env.OPENAI_API_KEY);
  const anthropic = new AnthropicConnector(process.env.ANTHROPIC_API_KEY);
  const perplexity = new PerplexityConnector(process.env.PERPLEXITY_API_KEY);
  const google = new GoogleAiOverviewConnector(process.env.SERPAPI_API_KEY);

  const real: [AIPlatformConnector, boolean][] = [
    [openai, openai.isConfigured],
    [anthropic, anthropic.isConfigured],
    [perplexity, perplexity.isConfigured],
    [google, google.isConfigured],
  ];

  return real.map(([connector, configured]) =>
    configured ? connector : new DemoConnector(connector.id, PLATFORM_LABELS[connector.id])
  );
}

export function getConnector(id: PlatformId): AIPlatformConnector {
  const found = getConnectors().find((c) => c.id === id);
  if (found) return found;
  return new DemoConnector(id, PLATFORM_LABELS[id]);
}
