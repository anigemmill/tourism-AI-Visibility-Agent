import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "@/components/dashboard/score-bar";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { AlertTriangle, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [snapshot, digest, queryCount, resultStats, openOpportunities, openIssues, demoPlatforms] = await Promise.all([
    prisma.visibilitySnapshot.findFirst({ where: { businessId: id }, orderBy: { createdAt: "desc" }, include: { components: true } }),
    prisma.dailyDigest.findFirst({ where: { businessId: id }, orderBy: { date: "desc" } }),
    prisma.travellerQuery.count({ where: { businessId: id } }),
    prisma.discoveryResult.groupBy({ by: ["businessAppears"], where: { businessId: id }, _count: true }),
    prisma.contentOpportunity.count({ where: { businessId: id, status: "open" } }),
    prisma.factCheckIssue.count({ where: { businessId: id, status: "open" } }),
    prisma.discoveryResult.findMany({ where: { businessId: id, isDemoData: true }, distinct: ["platform"], select: { platform: true } }),
  ]);

  const appeared = resultStats.find((r) => r.businessAppears)?._count ?? 0;
  const totalResults = resultStats.reduce((a, r) => a + r._count, 0);

  if (!snapshot) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Sparkles className="size-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Analysis in progress</h2>
          <p className="max-w-sm text-sm text-slate-500">
            The first crawl and AI monitoring pass runs automatically after onboarding and can take a minute.
            Refresh this page shortly, or use &quot;Run full analysis&quot; above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DemoBanner platforms={demoPlatforms.map((p) => p.platform)} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Traveller questions monitored" value={queryCount} />
        <StatTile
          label="AI appearance rate"
          value={totalResults ? `${Math.round((appeared / totalResults) * 100)}%` : "—"}
          hint={totalResults ? `${appeared}/${totalResults} responses` : "No monitoring runs yet"}
        />
        <StatTile label="Open content opportunities" value={openOpportunities} href={`/dashboard/${id}/opportunities`} />
        <StatTile
          label="Open fact-check issues"
          value={openIssues}
          href={`/dashboard/${id}/recommendations`}
          tone={openIssues > 0 ? "danger" : "default"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visibility breakdown</CardTitle>
          <CardDescription>
            No single score — each component below is independently meaningful, with the signals behind it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {snapshot.components.map((c) => (
            <ScoreBar key={c.id} label={c.label} score={c.score} explanation={c.explanation} />
          ))}
        </CardContent>
      </Card>

      {digest && (
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s digest</CardTitle>
            <CardDescription>{new Date(digest.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <DigestSection title="What changed" icon={<Sparkles className="size-4 text-indigo-600" />} text={digest.whatChanged} />
            <DigestSection title="Why it matters" icon={<AlertTriangle className="size-4 text-amber-600" />} text={digest.whyItMatters} />
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="size-4 text-emerald-600" /> What to do
              </div>
              <ul className="flex flex-col gap-2">
                {(digest.whatToDo as { action: string; priority: string }[]).slice(0, 5).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <Badge variant={priorityVariant(item.priority)} className="mt-0.5 shrink-0">
                      {item.priority}
                    </Badge>
                    {item.action}
                  </li>
                ))}
              </ul>
              <Link
                href={`/dashboard/${id}/recommendations`}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
              >
                View all recommendations <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DigestSection({ title, icon, text }: { title: string; icon: React.ReactNode; text: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon} {title}
      </div>
      <div className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{text}</div>
    </div>
  );
}

function priorityVariant(priority: string): "danger" | "warning" | "info" | "default" {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "default";
}

function StatTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "default" | "danger";
}) {
  const content = (
    <Card className="h-full">
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`text-2xl font-semibold tracking-tight ${tone === "danger" && Number(value) > 0 ? "text-rose-600" : "text-slate-900"}`}>
          {value}
        </span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
