import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "@/components/dashboard/score-bar";
import { ActionButton } from "@/components/dashboard/action-button";
import { formatRelativeDate } from "@/lib/utils";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export default async function TechnicalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [snapshots, scoreSnapshot] = await Promise.all([
    prisma.crawlSnapshot.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.visibilitySnapshot.findFirst({ where: { businessId: id }, orderBy: { createdAt: "desc" }, include: { components: true } }),
  ]);

  const technical = scoreSnapshot?.components.find((c) => c.key === "technical_accessibility");
  const entity = scoreSnapshot?.components.find((c) => c.key === "entity_clarity");
  const latest = snapshots[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Technical Health</h2>
          <p className="text-sm text-slate-500">Can AI crawlers and answer engines actually read this website?</p>
        </div>
        <ActionButton endpoint={`/api/businesses/${id}/crawl`} label="Re-crawl website" loadingLabel="Crawling..." icon={<RefreshCw />} variant="primary" size="sm" />
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-5 py-5 sm:grid-cols-2">
          {technical && <ScoreBar label={technical.label} score={technical.score} explanation={technical.explanation} />}
          {entity && <ScoreBar label={entity.label} score={entity.score} explanation={entity.explanation} />}
        </CardContent>
      </Card>

      {latest && (
        <Card>
          <CardHeader>
            <CardTitle>Latest crawl</CardTitle>
            <CardDescription>{formatRelativeDate(latest.createdAt)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                {latest.status === "success" ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : latest.status === "partial" ? (
                  <CheckCircle2 className="size-4 text-amber-600" />
                ) : (
                  <XCircle className="size-4 text-rose-600" />
                )}
                <Badge variant={latest.status === "success" ? "success" : latest.status === "partial" ? "warning" : "danger"}>
                  {latest.status}
                </Badge>
              </span>
              <span className="text-slate-500">{latest.pagesCrawled} pages crawled</span>
            </div>
            {Array.isArray(latest.errors) && latest.errors.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-lg bg-rose-50 p-3">
                {(latest.errors as string[]).map((e, i) => (
                  <li key={i} className="text-xs text-rose-700">
                    {e}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Crawl history</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-slate-100">
            {snapshots.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-600">{formatRelativeDate(s.createdAt)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{s.pagesCrawled} pages</span>
                  <Badge variant={s.status === "success" ? "success" : s.status === "partial" ? "warning" : "danger"}>{s.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
