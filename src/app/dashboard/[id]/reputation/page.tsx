import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "@/components/dashboard/score-bar";
import { Star, Award } from "lucide-react";

export default async function ReputationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [reviews, credentials, snapshot] = await Promise.all([
    prisma.review.findMany({ where: { businessId: id }, orderBy: { fetchedAt: "desc" } }),
    prisma.credential.findMany({ where: { businessId: id } }),
    prisma.visibilitySnapshot.findFirst({ where: { businessId: id }, orderBy: { createdAt: "desc" }, include: { components: true } }),
  ]);

  const reputationScore = snapshot?.components.find((c) => c.key === "review_reputation");
  const authorityScore = snapshot?.components.find((c) => c.key === "third_party_authority");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Reputation</h2>
        <p className="text-sm text-slate-500">Review signals and third-party authority — what AI systems use as trust corroboration.</p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-5 py-5 sm:grid-cols-2">
          {reputationScore && <ScoreBar label={reputationScore.label} score={reputationScore.score} explanation={reputationScore.explanation} />}
          {authorityScore && <ScoreBar label={authorityScore.label} score={authorityScore.score} explanation={authorityScore.explanation} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reviews on record</CardTitle>
          <CardDescription>Per-platform review data captured from the business profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <EmptyState icon={<Star className="size-8 text-slate-300" />} text="No review data on record yet." />
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100">
              {reviews.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-800">{r.platform}</span>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    {r.rating != null && (
                      <span className="flex items-center gap-1">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" /> {r.rating.toFixed(1)}
                      </span>
                    )}
                    {r.reviewCount != null && <span>{r.reviewCount} reviews</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credentials & awards</CardTitle>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <EmptyState icon={<Award className="size-8 text-slate-300" />} text="No credentials or awards on record yet." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {credentials.map((c) => (
                <Badge key={c.id} variant="info">
                  {c.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      {icon}
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}
