import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/dashboard/action-button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CheckCircle2, XCircle, MinusCircle, RefreshCw } from "lucide-react";

export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const queries = await prisma.travellerQuery.findMany({
    where: { businessId: id },
    orderBy: { commercialIntent: "desc" },
    include: { discoveryResults: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Traveller Questions</h2>
          <p className="text-sm text-slate-500">
            The commercially-relevant questions travellers actually ask AI assistants, generated from this
            business&apos;s destination, category, and target segments.
          </p>
        </div>
        <ActionButton
          endpoint={`/api/businesses/${id}/queries/generate`}
          label="Generate more questions"
          loadingLabel="Generating..."
          icon={<RefreshCw />}
          variant="outline"
          size="sm"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{queries.length} monitored questions</CardTitle>
          <CardDescription>Latest status per question, across all monitored platforms.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Commercial intent</TableHead>
                <TableHead>Recent status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-xs font-medium text-slate-800">{q.text}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{q.intent}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{q.segment ?? "—"}</TableCell>
                  <TableCell className="text-slate-500">{Math.round(q.commercialIntent * 100)}%</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {q.discoveryResults.length === 0 ? (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MinusCircle className="size-3.5" /> Not monitored yet
                        </span>
                      ) : (
                        q.discoveryResults.map((r) =>
                          r.businessAppears ? (
                            <CheckCircle2 key={r.id} className="size-4 text-emerald-600" />
                          ) : (
                            <XCircle key={r.id} className="size-4 text-slate-300" />
                          )
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
