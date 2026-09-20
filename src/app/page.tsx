import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Compass, Plus, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const businesses = await prisma.business.findMany({
    where: { accountId: session.accountId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { discoveryResults: true, contentOpportunities: true, factCheckIssues: true } },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Compass className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">Tourism AI Visibility Agent</h1>
            <p className="text-xs text-slate-500">AI discovery intelligence for tourism businesses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="primary">
            <Link href="/onboarding">
              <Plus /> Add a business
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </header>

      {businesses.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Compass className="size-6" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">No businesses onboarded yet</h2>
            <p className="max-w-sm text-sm text-slate-500">
              When travellers ask AI where they should go and who they should book with — does your business show
              up? Onboard your first business to find out.
            </p>
            <Button asChild variant="primary" className="mt-2">
              <Link href="/onboarding">
                <Plus /> Onboard a business
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link key={b.id} href={`/dashboard/${b.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{b.name}</CardTitle>
                    <Badge variant="info">{b.category}</Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="size-3" /> {b.destination}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4 pt-3 text-xs text-slate-500">
                  <span>{b._count.discoveryResults} monitored responses</span>
                  <span>·</span>
                  <span>{b._count.contentOpportunities} opportunities</span>
                  {b._count.factCheckIssues > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-rose-600">{b._count.factCheckIssues} fact-check issues</span>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
