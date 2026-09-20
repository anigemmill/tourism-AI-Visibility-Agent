import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Compass, MapPin, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/get-session";
import { DashboardNav } from "@/components/dashboard/nav";
import { MonitoringActionButton } from "@/components/dashboard/monitoring-action-button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const business = await prisma.business.findUnique({ where: { id } });
  // 404 rather than 403 for a business belonging to another account, so a
  // cross-tenant request can't distinguish "doesn't exist" from "isn't yours."
  if (!business || business.accountId !== session.accountId) notFound();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Compass className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-slate-900">{business.name}</h1>
                <Badge variant="info">{business.category}</Badge>
              </div>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="size-3" /> {business.destination}
                <a
                  href={business.website}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 flex items-center gap-0.5 text-indigo-600 hover:underline"
                >
                  Website <ExternalLink className="size-3" />
                </a>
              </p>
            </div>
          </div>
          <MonitoringActionButton
            endpoint={`/api/businesses/${business.id}/pipeline/run`}
            summaryPath="steps.monitoring"
            label="Run full analysis"
            loadingLabel="Running analysis..."
            variant="primary"
            size="sm"
          />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-6">
        <aside className="w-56 shrink-0">
          <DashboardNav businessId={business.id} />
        </aside>
        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}
