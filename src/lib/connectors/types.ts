// Pluggable AI-platform connector contract.
//
// Every platform we monitor — a chat LLM, a search AI overview, whatever
// gets added next — implements this same interface. The monitoring
// pipeline (see lib/monitoring) never branches on platform identity; it
// just calls `.ask()` and stores whatever comes back, verbatim, as
// evidence. This is what lets a destination or business be onboarded, and
// a new platform be added, without touching the core engine.

export type PlatformId =
  | "openai"
  | "anthropic"
  | "perplexity"
  | "google_ai_overview"
  | "demo";

export interface PlatformSource {
  title: string;
  url: string;
}

/** Raw, unprocessed answer from a platform for a single traveller query. */
export interface PlatformResponse {
  platform: PlatformId;
  /** True only when no real API key was configured and this is illustrative sample data. */
  isDemoData: boolean;
  /** The full raw response text. This is the evidence — never summarized or fabricated. */
  responseText: string;
  /** Citations/sources the platform itself surfaced, if any. Empty array if none were returned. */
  sources: PlatformSource[];
  /** ISO timestamp of when the query was run. */
  queriedAt: string;
  /** Set when the platform call failed; responseText will be empty in that case. */
  error?: string;
}

/**
 * Optional grounding context, used only by the demo connector to synthesize
 * plausible-looking (and clearly labeled) sample output when no API key is
 * configured. Live connectors ignore it — they send the traveller's raw
 * question and report back whatever the real platform actually said.
 */
export interface DemoContext {
  businessName: string;
  destination: string;
  category: string;
  competitorNames: string[];
}

export interface AIPlatformConnector {
  readonly id: PlatformId;
  readonly label: string;
  /** Whether this connector is backed by a live API key (false => connector is disabled entirely, not demo). */
  readonly isConfigured: boolean;
  ask(query: string, demoContext?: DemoContext): Promise<PlatformResponse>;
}
