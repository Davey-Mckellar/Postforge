import { NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { shipments } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

const shipmentInput = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  cargoDescription: z.string().optional(),
  weightKg: z.string().optional(),
  declaredValue: z.string().optional(),
  targetPrice: z.string().optional(),
  pickupWindowStart: z.string().datetime().optional(),
  pickupWindowEnd: z.string().datetime().optional(),
});

export async function GET() {
  const rows = await db.select().from(shipments).orderBy(desc(shipments.createdAt)).limit(50);
  return NextResponse.json({ shipments: rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = shipmentInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const v = parsed.data;
  const [created] = await db
    .insert(shipments)
    .values({
      senderId: user.id,
      origin: v.origin,
      destination: v.destination,
      cargoDescription: v.cargoDescription,
      weightKg: v.weightKg,
      declaredValue: v.declaredValue,
      targetPrice: v.targetPrice,
      pickupWindowStart: v.pickupWindowStart ? new Date(v.pickupWindowStart) : undefined,
      pickupWindowEnd: v.pickupWindowEnd ? new Date(v.pickupWindowEnd) : undefined,
    })
    .returning();

  return NextResponse.json({ shipment: created }, { status: 201 });
}
