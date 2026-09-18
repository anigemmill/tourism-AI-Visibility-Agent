import { CheckCircle2, XCircle, FlaskConical, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/lib/utils";

export interface DiscoveryResultForDisplay {
  id: string;
  platform: string;
  isDemoData: boolean;
  businessAppears: boolean;
  positionRank: number | null;
  howDescribed: string | null;
  responseText: string;
  confidence: number;
  sources: unknown;
  createdAt: Date | string;
  query: { text: string };
}

const PLATFORM_LABELS: Record<string, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  perplexity: "Perplexity",
  google_ai_overview: "Google AI Overview",
  demo: "Demo",
};

export function DiscoveryResultList({ results }: { results: DiscoveryResultForDisplay[] }) {
  if (results.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No monitoring results yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-100">
      {results.map((r) => {
        const sources = Array.isArray(r.sources) ? (r.sources as { title: string; url: string }[]) : [];
        return (
          <li key={r.id} className="flex flex-col gap-2 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {r.businessAppears ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="size-4 shrink-0 text-slate-300" />
              )}
              <span className="text-sm font-medium text-slate-900">{r.query.text}</span>
              <Badge variant="outline">{PLATFORM_LABELS[r.platform] ?? r.platform}</Badge>
              {r.positionRank && <Badge variant="info">Position {r.positionRank}</Badge>}
              {r.isDemoData && (
                <Badge variant="warning">
                  <FlaskConical className="size-3" /> Demo data
                </Badge>
              )}
              <span className="ml-auto text-xs text-slate-400">{formatRelativeDate(r.createdAt)}</span>
            </div>
            {r.howDescribed && (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                &ldquo;{r.howDescribed}&rdquo;
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>Confidence {Math.round(r.confidence * 100)}%</span>
              {sources.slice(0, 3).map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-indigo-600 hover:underline"
                >
                  <Link2 className="size-3" /> {s.title || s.url}
                </a>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
