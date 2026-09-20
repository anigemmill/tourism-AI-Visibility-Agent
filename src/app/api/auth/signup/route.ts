import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signupSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { accountName, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const account = await prisma.account.create({
    data: {
      name: accountName,
      users: { create: { email, passwordHash, name } },
    },
    include: { users: true },
  });
  const user = account.users[0];

  const token = await createSessionToken({ userId: user.id, accountId: account.id, email: user.email });
  const res = NextResponse.json({ account: { id: account.id, name: account.name }, user: { id: user.id, email: user.email } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
