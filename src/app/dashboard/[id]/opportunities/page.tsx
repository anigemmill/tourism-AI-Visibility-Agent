import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/dashboard/action-button";
import { OpportunityStatusControls } from "@/components/dashboard/opportunity-status-controls";
import { Lightbulb, Sparkles } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  faq: "FAQ",
  page: "Page",
  comparison: "Comparison",
  itinerary: "Itinerary",
  destination: "Destination content",
  metadata: "Metadata",
};

export default async function OpportunitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const opportunities = await prisma.contentOpportunity.findMany({
    where: { businessId: id, status: { in: ["open", "in_progress"] } },
    orderBy: { priorityScore: "desc" },
    include: { generatedContent: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Content Opportunities</h2>
          <p className="text-sm text-slate-500">
            Prioritized by commercial intent, traveller demand, competition, business relevance, and effort — see
            the formula in each card&apos;s rationale.
          </p>
        </div>
        <ActionButton
          endpoint={`/api/businesses/${id}/opportunities/generate`}
          label="Find new opportunities"
          loadingLabel="Analyzing..."
          icon={<Lightbulb />}
          variant="primary"
          size="sm"
        />
      </div>

      {opportunities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Lightbulb className="size-8 text-slate-300" />
            <h2 className="text-base font-semibold text-slate-900">No open opportunities</h2>
            <p className="max-w-sm text-sm text-slate-500">
              Run monitoring first so there&apos;s data to find gaps in, then generate opportunities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {opportunities.map((o) => (
            <Card key={o.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline">{TYPE_LABELS[o.type] ?? o.type}</Badge>
                      <span className="text-xs text-slate-400">Priority {Math.round(o.priorityScore)}/100</span>
                    </div>
                    <CardTitle>{o.title}</CardTitle>
                  </div>
                  <OpportunityStatusControls businessId={id} opportunityId={o.id} />
                </div>
                <CardDescription>{o.rationale}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  <Factor label="Intent" value={o.commercialIntent} />
                  <Factor label="Demand" value={o.travellerDemand} />
                  <Factor label="Competition" value={o.competitionLevel} invert />
                  <Factor label="Relevance" value={o.businessRelevance} />
                  <Factor label="Effort" value={o.implementationEffort} invert />
                </div>

                {o.generatedContent.length > 0 ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    {o.generatedContent.map((g) => (
                      <div key={g.id}>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {g.kind.replace("_", " ")}
                        </span>
                        <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-slate-700">{g.body}</pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ActionButton
                    endpoint={`/api/businesses/${id}/opportunities/${o.id}/generate-content`}
                    label="Create it"
                    loadingLabel="Drafting content..."
                    icon={<Sparkles />}
                    variant="subtle"
                    size="sm"
                    className="self-start"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Factor({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const displayValue = invert ? 1 - value : value;
  const pct = Math.round(displayValue * 100);
  return (
    <div className="flex flex-col items-center gap-1 rounded-md bg-slate-50 py-2">
      <span className="text-sm font-semibold text-slate-800">{pct}</span>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}
