import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getWalletClerkIdFromRequest, assertAuthorized } from "@/lib/session-server";
import { isGateEnabled } from "@/lib/server-config";
import { INTRO_INTAKE_MIN_CHARS } from "@/lib/onboarding-intake-storage";

export const runtime = "nodejs";

/** GET /api/profile/journey — return saved questionnaire answers for the current user. */
export async function GET(req: NextRequest) {
  if (!isGateEnabled()) {
    return NextResponse.json({ source: "none" });
  }

  const denied = await assertAuthorized(req);
  if (denied) return denied;

  const userId = await getWalletClerkIdFromRequest(req);

  try {
    const db = getDb();
    const [row] = await db
      .select({ introAnswers: users.introAnswers, introCompletedAt: users.introCompletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row?.introAnswers || !row.introCompletedAt) {
      return NextResponse.json({ source: "server", complete: false });
    }

    return NextResponse.json({
      source: "server",
      complete: true,
      answers: row.introAnswers,
      completedAt: row.introCompletedAt.getTime(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH /api/profile/journey — save questionnaire answers for the current user. */
export async function PATCH(req: NextRequest) {
  if (!isGateEnabled()) {
    return NextResponse.json({ ok: true, source: "none" });
  }

  const denied = await assertAuthorized(req);
  if (denied) return denied;

  let body: { answers?: unknown };
  try {
    body = (await req.json()) as { answers?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !Array.isArray(body.answers) ||
    body.answers.length !== 7 ||
    !body.answers.every(
      (a) => typeof a === "string" && a.trim().length >= INTRO_INTAKE_MIN_CHARS,
    )
  ) {
    return NextResponse.json(
      { error: "answers must be an array of 7 strings, each at least " + INTRO_INTAKE_MIN_CHARS + " characters." },
      { status: 400 },
    );
  }

  const answers = (body.answers as string[]).map((a) => a.trim());
  const userId = await getWalletClerkIdFromRequest(req);

  try {
    const db = getDb();
    await db
      .update(users)
      .set({ introAnswers: answers, introCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));

    return NextResponse.json({ ok: true, source: "server" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
