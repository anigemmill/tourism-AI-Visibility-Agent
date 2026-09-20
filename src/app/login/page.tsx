import Link from "next/link";
import { Suspense } from "react";
import { Compass } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
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
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Welcome back.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-slate-500">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-indigo-600 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
