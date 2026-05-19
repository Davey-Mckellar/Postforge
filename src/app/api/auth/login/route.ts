import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-cookie";
import { verifyUserCredentials } from "@/lib/auth-users";
import { createSessionJwt } from "@/lib/session-token";
import { getAppPassword, getSessionSecret, isUserAuthEnabled } from "@/lib/server-config";

export const runtime = "nodejs";

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export async function POST(req: NextRequest) {
  try {
    const secret = getSessionSecret();
    if (!secret) {
      return NextResponse.json({ error: "BBGPT_SESSION_SECRET is not set." }, { status: 500 });
    }

    if (isUserAuthEnabled()) {
      let body: { email?: string; password?: string };
      try {
        body = (await req.json()) as { email?: string; password?: string };
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password required." }, { status: 400 });
      }

      let user: Awaited<ReturnType<typeof verifyUserCredentials>>;
      try {
        user = await verifyUserCredentials(email, password);
      } catch (dbErr) {
        console.error("LOGIN_DB_ERROR:", dbErr instanceof Error ? dbErr.message : String(dbErr));
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
      if (!user) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }

      const token = await createSessionJwt(user.id, { email: user.email });
      const res = NextResponse.json({ ok: true, mode: "user" as const });
      res.cookies.set(SESSION_COOKIE_NAME, token, cookieOpts);
      return res;
    }

    const expected = getAppPassword();
    if (!expected) {
      return NextResponse.json(
        { error: "Set BBGPT_APP_PASSWORD or enable BBGPT_USER_AUTH=1 with Postgres." },
        { status: 400 },
      );
    }

    let body: { password?: string };
    try {
      body = (await req.json()) as { password?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const submitted = String(body.password ?? "").trim();
    if (submitted !== expected) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }

    const token = await createSessionJwt("default");
    const res = NextResponse.json({ ok: true, mode: "legacy" as const });
    res.cookies.set(SESSION_COOKIE_NAME, token, cookieOpts);
    return res;
  } catch (error) {
    console.error("LOGIN_ERROR:", error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Internal server error", details }, { status: 500 });
  }
}
