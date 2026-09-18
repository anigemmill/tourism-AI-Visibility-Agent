import { FlaskConical } from "lucide-react";

export function DemoBanner({ platforms }: { platforms: string[] }) {
  if (platforms.length === 0) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <FlaskConical className="mt-0.5 size-4 shrink-0" />
      <div>
        <span className="font-medium">Demo data included.</span> No API key is configured for{" "}
        {platforms.join(", ")}, so results from{" "}
        {platforms.length === 1 ? "that platform are" : "those platforms are"} synthetic samples generated
        locally — never presented as real findings. Add the corresponding API key in your environment to switch
        to live monitoring.
      </div>
    </div>
  );
}
