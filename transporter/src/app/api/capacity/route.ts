import { NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { capacityOffers } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

const capacityInput = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  capacityKg: z.string().optional(),
  askingPrice: z.string().optional(),
  availableWindowStart: z.string().datetime().optional(),
  availableWindowEnd: z.string().datetime().optional(),
});

export async function GET() {
  const rows = await db
    .select()
    .from(capacityOffers)
    .orderBy(desc(capacityOffers.createdAt))
    .limit(50);
  return NextResponse.json({ capacity: rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = capacityInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const v = parsed.data;
  const [created] = await db
    .insert(capacityOffers)
    .values({
      transporterId: user.id,
      origin: v.origin,
      destination: v.destination,
      capacityKg: v.capacityKg,
      askingPrice: v.askingPrice,
      availableWindowStart: v.availableWindowStart ? new Date(v.availableWindowStart) : undefined,
      availableWindowEnd: v.availableWindowEnd ? new Date(v.availableWindowEnd) : undefined,
    })
    .returning();

  return NextResponse.json({ capacity: created }, { status: 201 });
}
