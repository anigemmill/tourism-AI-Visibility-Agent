import { analyzeCompetitors } from "@/lib/competitors/analyze-competitors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default async function CompetitorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { comparisons } = await analyzeCompetitors(id);

  if (comparisons.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Swords className="size-8 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-900">No competitors tracked yet</h2>
          <p className="max-w-sm text-sm text-slate-500">Add competitors during onboarding to see AI visibility comparisons here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Competitor Intelligence</h2>
        <p className="text-sm text-slate-500">Same monitored queries, compared head-to-head against each tracked competitor.</p>
      </div>

      {comparisons.map((c) => (
        <Card key={c.competitorName}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{c.competitorName}</CardTitle>
              {c.competitorWebsite && (
                <a href={c.competitorWebsite} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                  {c.competitorWebsite}
                </a>
              )}
            </div>
            <CardDescription>{c.headline}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat icon={<TrendingDown className="size-3.5 text-rose-600" />} label="Competitor owns" value={c.queriesCompetitorOwns.length} />
              <MiniStat icon={<Minus className="size-3.5 text-slate-400" />} label="Both appear" value={c.queriesBothAppear.length} />
              <MiniStat icon={<TrendingUp className="size-3.5 text-emerald-600" />} label="You own" value={c.queriesBusinessOwns.length} />
            </div>

            {c.queriesCompetitorOwns.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Topics {c.competitorName} owns
                </h4>
                <ul className="flex flex-col gap-1.5">
                  {c.queriesCompetitorOwns.slice(0, 8).map((q) => (
                    <li key={q.queryId} className="flex items-center gap-2 text-sm text-slate-700">
                      <Badge variant="danger">Gap</Badge>
                      {q.queryText}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {c.likelyReasons.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-3">
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Likely reasons</h4>
                <ul className="flex flex-col gap-1.5">
                  {c.likelyReasons.map((r, i) => (
                    <li key={i} className="text-xs leading-relaxed text-slate-600">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-slate-100 py-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-lg font-semibold text-slate-900">{value}</span>
      </div>
      <span className="text-[11px] text-slate-400">{label}</span>
    </div>
  );
}
