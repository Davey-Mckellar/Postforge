import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAME } from "@/lib/auth-cookie";
import { getSessionSecret, isGateEnabled } from "@/lib/server-config";

const PUBLIC_PATHS = ["/login","/register","/forgot-password","/_next","/favicon.ico","/api/auth","/api/stripe/webhook","/api/org/activation-status"];
const JAIL_ALLOWED = ["/onboarding","/api/onboarding","/schedule-first-post","/api/schedule-first-post","/brand-setup","/batch-review","/api/brands","/api/batches"];

const isPublic = (p: string) => PUBLIC_PATHS.some((x) => p.startsWith(x));
const isJailOk = (p: string) => JAIL_ALLOWED.some((x) => p.startsWith(x));

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  if (!isGateEnabled()) return NextResponse.next();

  const token =
    request.cookies.get(SESSION_COOKIE_NAME)?.value ??
    request.cookies.get(LEGACY_SESSION_COOKIE_NAME)?.value;

  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(getSessionSecret()));
    if (typeof payload.sub !== "string" || !payload.sub) throw new Error();
    userId = payload.sub;
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const orgRes = await fetch(
      new URL(`/api/org/activation-status?userId=${userId}`, request.url),
      { headers: { "x-internal-secret": process.env.BBGPT_API_SECRET ?? "" } },
    );
    if (orgRes.ok) {
      const data = (await orgRes.json()) as { activationStatus?: string; organizationId?: string };
      const res = NextResponse.next();
      res.headers.set("x-user-id", userId);
      if (data.organizationId) res.headers.set("x-organization-id", data.organizationId);
      if (data.activationStatus === "PENDING" && !isJailOk(pathname)) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
      return res;
    }
  } catch { /* pass through on lookup failure */ }

  const res = NextResponse.next();
  res.headers.set("x-user-id", userId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
