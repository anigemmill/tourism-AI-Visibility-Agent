import Link from "next/link";
import { Compass } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SignupPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Compass className="size-5" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Tourism AI Visibility Agent</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>One account per company — you can onboard multiple businesses under it.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
