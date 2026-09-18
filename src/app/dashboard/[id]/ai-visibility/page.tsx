import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ActionButton } from "@/components/dashboard/action-button";
import { DiscoveryResultList } from "@/components/dashboard/discovery-result-list";
import { RefreshCw } from "lucide-react";

const CHAT_PLATFORMS = ["openai", "anthropic", "perplexity"];
const PLATFORM_LABELS: Record<string, string> = { openai: "ChatGPT", anthropic: "Claude", perplexity: "Perplexity" };

export default async function AiVisibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const results = await prisma.discoveryResult.findMany({
    where: { businessId: id, platform: { in: CHAT_PLATFORMS } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { query: true },
  });

  const byPlatform = CHAT_PLATFORMS.map((platform) => {
    const platformResults = results.filter((r) => r.platform === platform);
    const appeared = platformResults.filter((r) => r.businessAppears).length;
    return { platform, total: platformResults.length, appeared };
  }).filter((p) => p.total > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">AI Visibility</h2>
          <p className="text-sm text-slate-500">
            Whether conversational AI assistants (ChatGPT, Claude, Perplexity) surface this business when
            travellers ask.
          </p>
        </div>
        <ActionButton
          endpoint={`/api/businesses/${id}/monitor/run`}
          label="Run monitoring"
          loadingLabel="Querying platforms..."
          icon={<RefreshCw />}
          variant="primary"
          size="sm"
        />
      </div>

      {byPlatform.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {byPlatform.map((p) => (
            <Card key={p.platform}>
              <CardContent className="flex flex-col gap-1 py-4">
                <span className="text-xs font-medium text-slate-500">{PLATFORM_LABELS[p.platform]}</span>
                <span className="text-2xl font-semibold text-slate-900">
                  {Math.round((p.appeared / p.total) * 100)}%
                </span>
                <span className="text-xs text-slate-400">
                  Appeared in {p.appeared} of {p.total} monitored responses
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Monitored responses</CardTitle>
          <CardDescription>Every result below carries the platform&apos;s actual response as evidence.</CardDescription>
        </CardHeader>
        <CardContent>
          <DiscoveryResultList results={results} />
        </CardContent>
      </Card>
    </div>
  );
}
