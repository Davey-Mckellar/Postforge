import { LEGACY_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth-cookie";
import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getApiSecret, getSessionSecret, isGateEnabled, isUserAuthEnabled } from "@/lib/server-config";

// ─── Simple burst rate limiter (in-memory, per-process) ──────────────────────
// Provides burst protection on auth and chat endpoints.
// Not a substitute for a Redis-backed limiter in high-traffic multi-instance
// deploys, but materially reduces single-IP brute-force risk on Vercel.
const RATE_WINDOWS = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string, route: string, limit: number, windowMs: number): boolean {
  const key = `${ip}:${route}`;
  const now = Date.now();
  const entry = RATE_WINDOWS.get(key);
  if (!entry || now > entry.resetAt) {
    RATE_WINDOWS.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  if (entry.count > limit) return true;
  return false;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIp(request);

  // ── Rate limiting (before auth gate) ────────────────────────────────────────
  // Auth routes: 10 requests per minute per IP
  if (pathname.startsWith("/api/auth/") || pathname === "/login" || pathname === "/register") {
    if (isRateLimited(ip, "auth", 10, 60_000)) {
      return NextResponse.json({ error: "Too many requests — try again in a minute." }, { status: 429 });
    }
  }
  // Chat route: 60 requests per minute per IP (credits are the real gate, this stops burst spam)
  if (pathname.startsWith("/api/chat")) {
    if (isRateLimited(ip, "chat", 60, 60_000)) {
      return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
    }
  }

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (!isGateEnabled()) {
    return NextResponse.next();
  }

  // ── Public pages (auth gate bypassed) ──────────────────────────────────────
  // Auth pages
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) {
    return NextResponse.next();
  }
  // SEO / marketing landing pages — must be publicly crawlable by Googlebot
  if (
    pathname === "/chatgpt-alternative" ||
    pathname === "/claude-alternative" ||
    pathname === "/gemini-alternative" ||
    pathname === "/perplexity-alternative" ||
    pathname === "/ai-chat-credits" ||
    pathname === "/ai-developer-alex"
  ) {
    return NextResponse.next();
  }
  // SEO infrastructure — sitemap and robots must be publicly accessible
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  // Stripe webhook bypasses auth — Stripe signs requests with STRIPE_WEBHOOK_SECRET
  if (pathname === "/api/stripe/webhook" || pathname.startsWith("/api/stripe/webhook/")) {
    return NextResponse.next();
  }

  const apiSecret = getApiSecret();
  const auth = request.headers.get("authorization");
  if (apiSecret && auth === `Bearer ${apiSecret}`) {
    return NextResponse.next();
  }

  const secret = getSessionSecret();
  if (!secret) {
    if (pathname.startsWith("/api")) {
      const hint = isUserAuthEnabled()
        ? "Set BBGPT_SESSION_SECRET when the gate is enabled."
        : "Set BBGPT_SESSION_SECRET when BBGPT_APP_PASSWORD (or BBGPT_USER_AUTH) is set.";
      return NextResponse.json({ error: `Server misconfigured: ${hint}` }, { status: 500 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token =
    request.cookies.get(SESSION_COOKIE_NAME)?.value ??
    request.cookies.get(LEGACY_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|bbgpt-logo.png|babygpt-logo.png|.*\\.(?:ico|png|jpg|jpeg|svg|webp|gif)$).*)",
  ],
};
