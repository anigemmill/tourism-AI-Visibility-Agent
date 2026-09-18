import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VisibilityTrendChart } from "@/components/dashboard/visibility-trend-chart";
import { formatRelativeDate } from "@/lib/utils";

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [snapshots, digests] = await Promise.all([
    prisma.visibilitySnapshot.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { components: true },
    }),
    prisma.dailyDigest.findMany({ where: { businessId: id }, orderBy: { date: "desc" }, take: 14 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">History</h2>
        <p className="text-sm text-slate-500">Visibility trend over time and the daily digest archive.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visibility trend</CardTitle>
          <CardDescription>{snapshots.length} snapshot(s) recorded.</CardDescription>
        </CardHeader>
        <CardContent>
          <VisibilityTrendChart snapshots={snapshots.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Digest archive</CardTitle>
        </CardHeader>
        <CardContent>
          {digests.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No digests generated yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100">
              {digests.map((d) => (
                <li key={d.id} className="flex flex-col gap-1 py-4">
                  <span className="text-xs font-semibold text-slate-400">{formatRelativeDate(d.date)}</span>
                  <p className="whitespace-pre-line text-sm text-slate-700">{d.whatChanged}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
