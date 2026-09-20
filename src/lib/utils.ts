import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number) {
  return Math.round(score);
}

export function scoreLabel(score: number): "strong" | "moderate" | "weak" {
  if (score >= 70) return "strong";
  if (score >= 40) return "moderate";
  return "weak";
}

interface MonitoringResultLike {
  cooldownRemainingSeconds?: number;
  quotaExhausted?: boolean;
}

/** Turns a runMonitoring() summary into a short human note for rate-limit/quota feedback in the UI. */
export function describeMonitoringResult(summary: MonitoringResultLike | undefined | null): string | null {
  if (!summary) return null;
  if (summary.cooldownRemainingSeconds) {
    const minutes = Math.ceil(summary.cooldownRemainingSeconds / 60);
    return `Monitoring ran recently — try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  if (summary.quotaExhausted) {
    return "Today's monitoring quota for this business was reached — some queries were skipped. It resets on a rolling 24h basis.";
  }
  return null;
}

export function formatRelativeDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
