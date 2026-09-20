import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MonitoringActionButton } from "@/components/dashboard/monitoring-action-button";
import { DiscoveryResultList } from "@/components/dashboard/discovery-result-list";
import { RefreshCw } from "lucide-react";

export default async function SearchVisibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const results = await prisma.discoveryResult.findMany({
    where: { businessId: id, platform: "google_ai_overview" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { query: true },
  });

  const appeared = results.filter((r) => r.businessAppears).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Search Visibility</h2>
          <p className="text-sm text-slate-500">
            Whether this business appears in Google&apos;s AI Overview panel (or top organic results when no
            panel is shown) for traveller questions.
          </p>
        </div>
        <MonitoringActionButton
          endpoint={`/api/businesses/${id}/monitor/run`}
          summaryPath="summary"
          label="Run monitoring"
          loadingLabel="Querying search..."
          icon={<RefreshCw />}
          variant="primary"
          size="sm"
        />
      </div>

      {results.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-xs font-medium text-slate-500">Search visibility rate</span>
            <span className="text-2xl font-semibold text-slate-900">{Math.round((appeared / results.length) * 100)}%</span>
            <span className="text-xs text-slate-400">
              Appeared in {appeared} of {results.length} monitored search results
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Monitored search results</CardTitle>
          <CardDescription>
            Requires a SERPAPI_API_KEY to go live — otherwise this shows clearly labeled demo data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DiscoveryResultList results={results} />
        </CardContent>
      </Card>
    </div>
  );
}
