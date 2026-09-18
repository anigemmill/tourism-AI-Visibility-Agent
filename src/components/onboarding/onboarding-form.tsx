"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TagInput } from "./tag-input";

interface CompetitorRow {
  name: string;
  website: string;
}
interface ProductRow {
  name: string;
  description: string;
}

export function OnboardingForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [destination, setDestination] = useState("");
  const [category, setCategory] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [targetMarkets, setTargetMarkets] = useState<string[]>([]);
  const [targetSegments, setTargetSegments] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([{ name: "", website: "" }]);
  const [products, setProducts] = useState<ProductRow[]>([{ name: "", description: "" }]);

  const updateCompetitor = (i: number, field: keyof CompetitorRow, value: string) => {
    setCompetitors((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };
  const updateProduct = (i: number, field: keyof ProductRow, value: string) => {
    setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !website || !destination || !category) {
      setError("Business name, website, destination, and category are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          website,
          destination,
          category,
          bookingUrl: bookingUrl || undefined,
          targetMarkets,
          targetSegments,
          socialProfiles: { instagram: instagram || undefined, facebook: facebook || undefined },
          competitors: competitors.filter((c) => c.name.trim()).map((c) => ({ name: c.name, website: c.website || undefined })),
          products: products.filter((p) => p.name.trim()),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.formErrors?.join(", ") || "Failed to create business");
      }
      const { business } = await res.json();

      // Kick off the full analysis pipeline in the background — don't block
      // navigation on it; the dashboard shows progress/empty states until it lands.
      fetch(`/api/businesses/${business.id}/pipeline/run`, { method: "POST" }).catch(() => {});

      router.push(`/dashboard/${business.id}?firstRun=true`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Business basics</CardTitle>
          <CardDescription>Who are we monitoring, and where?</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Business name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rotorua Canopy Tours" />
          </Field>
          <Field label="Website" required>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="rotoruacanopytours.co.nz" />
          </Field>
          <Field label="Destination" required>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Rotorua, New Zealand" />
          </Field>
          <Field label="Tourism category" required>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Eco / Adventure Tours" />
          </Field>
          <Field label="Booking URL">
            <Input value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} placeholder="rotoruacanopytours.co.nz/book" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Instagram">
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" />
            </Field>
            <Field label="Facebook">
              <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/..." />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audience</CardTitle>
          <CardDescription>Who are you trying to reach? Press Enter to add each one.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Target markets">
            <TagInput values={targetMarkets} onChange={setTargetMarkets} placeholder="Australia, USA, UK..." />
          </Field>
          <Field label="Target traveller segments">
            <TagInput values={targetSegments} onChange={setTargetSegments} placeholder="families, adventurous couples..." />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products / experiences</CardTitle>
          <CardDescription>A starting point — we&apos;ll also crawl your website to fill this in.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {products.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={p.name}
                onChange={(e) => updateProduct(i, "name", e.target.value)}
                placeholder="Zipline Canopy Tour"
                className="flex-1"
              />
              <Input
                value={p.description}
                onChange={(e) => updateProduct(i, "description", e.target.value)}
                placeholder="Short description (optional)"
                className="flex-[2]"
              />
              <RemoveRowButton onClick={() => setProducts((prev) => prev.filter((_, idx) => idx !== i))} />
            </div>
          ))}
          <AddRowButton onClick={() => setProducts((prev) => [...prev, { name: "", description: "" }])} label="Add product" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competitors</CardTitle>
          <CardDescription>Who should we compare AI visibility against?</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {competitors.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={c.name}
                onChange={(e) => updateCompetitor(i, "name", e.target.value)}
                placeholder="Competitor name"
                className="flex-1"
              />
              <Input
                value={c.website}
                onChange={(e) => updateCompetitor(i, "website", e.target.value)}
                placeholder="Website (optional)"
                className="flex-[2]"
              />
              <RemoveRowButton onClick={() => setCompetitors((prev) => prev.filter((_, idx) => idx !== i))} />
            </div>
          ))}
          <AddRowButton onClick={() => setCompetitors((prev) => [...prev, { name: "", website: "" }])} label="Add competitor" />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Compass />}
          {submitting ? "Setting up..." : "Onboard business & run first analysis"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="self-start">
      <Plus /> {label}
    </Button>
  );
}

function RemoveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" onClick={onClick} className="shrink-0 text-slate-400 hover:text-rose-600">
      <Trash2 className="size-4" />
    </Button>
  );
}
