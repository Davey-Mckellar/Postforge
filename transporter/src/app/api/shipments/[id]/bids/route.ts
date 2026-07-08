import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { bids, shipments } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { expireStaleBids } from "@/lib/bids/expire";

const bidInput = z.object({
  amount: z.string().min(1),
  message: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await expireStaleBids({ shipmentId: id });
  const rows = await db
    .select()
    .from(bids)
    .where(eq(bids.shipmentId, id))
    .orderBy(desc(bids.createdAt));
  return NextResponse.json({ bids: rows });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: shipmentId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = bidInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [shipment] = await db
    .select({ id: shipments.id, senderId: shipments.senderId, status: shipments.status })
    .from(shipments)
    .where(eq(shipments.id, shipmentId))
    .limit(1);
  if (!shipment) return NextResponse.json({ error: "shipment_not_found" }, { status: 404 });
  if (shipment.senderId === user.id) {
    return NextResponse.json({ error: "cannot_bid_on_own_shipment" }, { status: 403 });
  }
  if (shipment.status !== "open" && shipment.status !== "bidding") {
    return NextResponse.json({ error: "shipment_not_biddable" }, { status: 409 });
  }

  const [created] = await db
    .insert(bids)
    .values({
      shipmentId,
      bidderId: user.id,
      amount: parsed.data.amount,
      message: parsed.data.message,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    })
    .returning();

  // Move shipment into "bidding" once its first bid arrives.
  if (shipment.status === "open") {
    await db
      .update(shipments)
      .set({ status: "bidding" })
      .where(and(eq(shipments.id, shipmentId), ne(shipments.status, "awarded")));
  }

  return NextResponse.json({ bid: created }, { status: 201 });
}
