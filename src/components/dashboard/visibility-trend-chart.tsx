"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select } from "@/components/ui/select";

interface SnapshotComponent {
  key: string;
  label: string;
  score: number;
}
interface Snapshot {
  id: string;
  createdAt: string | Date;
  components: SnapshotComponent[];
}

const SEQUENTIAL_BLUE = "#2a78d6"; // validated sequential hue, single-series line

export function VisibilityTrendChart({ snapshots }: { snapshots: Snapshot[] }) {
  const componentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of snapshots) for (const c of s.components) seen.set(c.key, c.label);
    return [...seen.entries()];
  }, [snapshots]);

  const [selected, setSelected] = useState(componentOptions[0]?.[0] ?? "ai_discoverability");

  const data = useMemo(
    () =>
      [...snapshots]
        .reverse()
        .map((s) => ({
          date: new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          score: s.components.find((c) => c.key === selected)?.score ?? null,
        }))
        .filter((d) => d.score !== null),
    [snapshots, selected]
  );

  if (componentOptions.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No visibility history yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          {componentOptions.find(([k]) => k === selected)?.[1]} over time
        </span>
        <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-56">
          {componentOptions.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ borderRadius: 8, borderColor: "#e1e0d9", fontSize: 12 }}
              labelStyle={{ color: "#52514e" }}
            />
            <Line type="monotone" dataKey="score" stroke={SEQUENTIAL_BLUE} strokeWidth={2} dot={{ r: 3, fill: SEQUENTIAL_BLUE }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
