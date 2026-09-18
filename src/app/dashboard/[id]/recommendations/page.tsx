import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/dashboard/action-button";
import { FactCheckIssueRow } from "@/components/dashboard/fact-check-issue-row";
import { ShieldAlert, ListChecks } from "lucide-react";

export default async function RecommendationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [issues, opportunities] = await Promise.all([
    prisma.factCheckIssue.findMany({
      where: { businessId: id, status: "open" },
      orderBy: [{ bookingImpact: "desc" }, { detectedAt: "desc" }],
    }),
    prisma.contentOpportunity.findMany({
      where: { businessId: id, status: "open" },
      orderBy: { priorityScore: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Recommendations</h2>
        <p className="text-sm text-slate-500">The highest-value actions right now — factual errors first, then content gaps.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-rose-600" /> AI Fact-Checker
              </CardTitle>
              <CardDescription>
                Incorrect or outdated information found in AI/search responses, compared against this business&apos;s own profile.
              </CardDescription>
            </div>
            <ActionButton
              endpoint={`/api/businesses/${id}/fact-check`}
              label="Run fact-check"
              loadingLabel="Checking..."
              variant="outline"
              size="sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No open fact-check issues.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100">
              {issues.map((issue) => (
                <FactCheckIssueRow key={issue.id} businessId={id} issue={issue} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4 text-indigo-600" /> Top content opportunities
          </CardTitle>
          <CardDescription>See the Content Opportunities tab for the full list and to generate drafts.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-slate-100">
            {opportunities.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm text-slate-700">{o.title}</span>
                <Badge variant="outline">Priority {Math.round(o.priorityScore)}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
