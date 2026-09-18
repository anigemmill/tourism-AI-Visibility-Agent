import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Onboard a tourism business</h1>
        <p className="mt-1 text-sm text-slate-500">
          We&apos;ll crawl the website to build a knowledge profile, generate the traveller questions AI assistants
          get asked, and run the first visibility analysis automatically.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
