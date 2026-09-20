"use client";

import type { ButtonProps } from "@/components/ui/button";
import { ActionButton } from "./action-button";
import { describeMonitoringResult } from "@/lib/utils";

interface MonitoringActionButtonProps extends Omit<ButtonProps, "onClick"> {
  endpoint: string;
  label: string;
  loadingLabel?: string;
  icon?: React.ReactNode;
  /** Dot-path to the monitoring summary in the JSON response, e.g. "summary" or "steps.monitoring". */
  summaryPath: string;
}

/**
 * An ActionButton specialized for endpoints that (directly or as one step
 * of a larger pipeline) call runMonitoring(), so a cooldown or exhausted
 * quota is surfaced to the user instead of silently doing nothing. Wraps
 * the note-extraction closure here — a Server Component can't pass a
 * function prop across to a Client Component, so this can't just be a
 * `getNote` prop supplied from the dashboard's (server) pages.
 */
export function MonitoringActionButton({ endpoint, label, loadingLabel, icon, summaryPath, ...buttonProps }: MonitoringActionButtonProps) {
  return (
    <ActionButton
      endpoint={endpoint}
      label={label}
      loadingLabel={loadingLabel}
      icon={icon}
      getNote={(data) => describeMonitoringResult(getAtPath(data, summaryPath))}
      {...buttonProps}
    />
  );
}

function getAtPath(data: unknown, path: string): Record<string, unknown> | undefined {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data) as Record<string, unknown> | undefined;
}
