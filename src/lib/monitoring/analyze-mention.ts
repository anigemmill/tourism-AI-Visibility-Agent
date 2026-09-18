export interface MentionAnalysis {
  businessAppears: boolean;
  positionRank: number | null;
  howDescribed: string | null;
  competitorsMentioned: { name: string; position: number }[];
  confidence: number;
}

/**
 * Detects whether a business (and which competitors) are mentioned in a raw
 * AI/search response. This is a text-matching heuristic, not a semantic
 * judgement — it never claims a business appears unless its name (or a
 * clear variant) is actually present in the evidence text, and the
 * confidence score reflects how exact that match was.
 */
export function analyzeMention(
  responseText: string,
  businessName: string,
  competitorNames: string[]
): MentionAnalysis {
  const businessMatch = findNameMention(responseText, businessName);

  const competitorsMentioned = competitorNames
    .map((name) => {
      const match = findNameMention(responseText, name);
      return match ? { name, position: match.index } : null;
    })
    .filter((v): v is { name: string; position: number } => v !== null)
    .sort((a, b) => a.position - b.position);

  // Rank = 1-based order of the business's mention relative to competitors' mentions.
  let positionRank: number | null = null;
  if (businessMatch) {
    const earlierCompetitors = competitorsMentioned.filter((c) => c.position < businessMatch.index).length;
    positionRank = earlierCompetitors + 1;
  }

  return {
    businessAppears: businessMatch !== null,
    positionRank,
    howDescribed: businessMatch ? extractSurroundingSentence(responseText, businessMatch.index) : null,
    competitorsMentioned: competitorsMentioned.map((c, i) => ({ name: c.name, position: i + 1 })),
    confidence: businessMatch?.confidence ?? computeAbsenceConfidence(responseText),
  };
}

function findNameMention(
  text: string,
  name: string
): { index: number; confidence: number } | null {
  if (!name.trim()) return null;
  const escaped = escapeRegExp(name.trim());

  // Exact, word-boundary match — highest confidence.
  const exact = new RegExp(`\\b${escaped}\\b`, "i");
  const exactMatch = exact.exec(text);
  if (exactMatch) return { index: exactMatch.index, confidence: 0.95 };

  // Loosened match: allow "The X" / "X Tours" style suffixes/prefixes by
  // matching just the first significant token sequence (first 2 words).
  const tokens = name.trim().split(/\s+/);
  if (tokens.length > 1) {
    const partial = tokens.slice(0, Math.min(2, tokens.length)).join("\\s+");
    const partialRe = new RegExp(`\\b${partial}`, "i");
    const partialMatch = partialRe.exec(text);
    if (partialMatch) return { index: partialMatch.index, confidence: 0.65 };
  }

  return null;
}

function extractSurroundingSentence(text: string, index: number): string {
  const before = text.lastIndexOf(".", index);
  const after = text.indexOf(".", index);
  const start = before === -1 ? Math.max(0, index - 80) : before + 1;
  const end = after === -1 ? Math.min(text.length, index + 200) : after + 1;
  return text.slice(start, end).trim();
}

function computeAbsenceConfidence(text: string): number {
  // If we have substantial text to search and still found nothing, we can
  // be fairly confident in the absence; short/empty responses are less reliable.
  if (text.length > 200) return 0.85;
  if (text.length > 50) return 0.6;
  return 0.3;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
