"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Search,
  Swords,
  MessageCircleQuestion,
  Lightbulb,
  Star,
  Wrench,
  ListChecks,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = (businessId: string) => [
  { href: `/dashboard/${businessId}`, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: `/dashboard/${businessId}/ai-visibility`, label: "AI Visibility", icon: Sparkles },
  { href: `/dashboard/${businessId}/search-visibility`, label: "Search Visibility", icon: Search },
  { href: `/dashboard/${businessId}/competitors`, label: "Competitors", icon: Swords },
  { href: `/dashboard/${businessId}/questions`, label: "Traveller Questions", icon: MessageCircleQuestion },
  { href: `/dashboard/${businessId}/opportunities`, label: "Content Opportunities", icon: Lightbulb },
  { href: `/dashboard/${businessId}/reputation`, label: "Reputation", icon: Star },
  { href: `/dashboard/${businessId}/technical`, label: "Technical Health", icon: Wrench },
  { href: `/dashboard/${businessId}/recommendations`, label: "Recommendations", icon: ListChecks },
  { href: `/dashboard/${businessId}/history`, label: "History", icon: History },
];

export function DashboardNav({ businessId }: { businessId: string }) {
  const pathname = usePathname();
  const items = NAV_ITEMS(businessId);

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
