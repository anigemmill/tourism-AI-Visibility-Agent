import { cn } from "@/lib/utils";

// Status palette (validated, fixed — never used as decoration, always paired
// with a text label so meaning never rides on color alone).
const BANDS = [
  { max: 40, hex: "#d03b3b", label: "Weak" },
  { max: 70, hex: "#fab219", label: "Moderate" },
  { max: 101, hex: "#0ca30c", label: "Strong" },
];

function bandFor(score: number) {
  return BANDS.find((b) => score < b.max) ?? BANDS[BANDS.length - 1];
}

export function ScoreBar({
  label,
  score,
  explanation,
  className,
}: {
  label: string;
  score: number;
  explanation?: string;
  className?: string;
}) {
  const band = bandFor(score);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-slate-900">{Math.round(score)}</span>
          <span className="text-xs font-medium" style={{ color: band.hex }}>
            {band.label}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, Math.min(100, score))}%`, backgroundColor: band.hex }}
        />
      </div>
      {explanation && <p className="text-xs leading-relaxed text-slate-500">{explanation}</p>}
    </div>
  );
}
