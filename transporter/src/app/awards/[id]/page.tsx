import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { awards, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AwardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sender = alias(users, "sender");
  const transporter = alias(users, "transporter");

  const [row] = await db
    .select({
      id: awards.id,
      shipmentId: awards.shipmentId,
      capacityOfferId: awards.capacityOfferId,
      bidId: awards.bidId,
      agreedPrice: awards.agreedPrice,
      status: awards.status,
      paymentStatus: awards.paymentStatus,
      createdAt: awards.createdAt,
      senderName: sender.name,
      senderEmail: sender.email,
      transporterName: transporter.name,
      transporterEmail: transporter.email,
    })
    .from(awards)
    .leftJoin(sender, eq(awards.senderId, sender.id))
    .leftJoin(transporter, eq(awards.transporterId, transporter.id))
    .where(eq(awards.id, id))
    .limit(1);

  if (!row) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Award</h1>
      <div className="rounded border border-neutral-200 bg-white p-4 text-sm">
        <div>
          <span className="text-neutral-500">Agreed price:</span>{" "}
          <span className="font-medium">${row.agreedPrice}</span>
        </div>
        <div>
          <span className="text-neutral-500">Status:</span> {row.status}
        </div>
        <div>
          <span className="text-neutral-500">Payment status:</span> {row.paymentStatus}
          <span className="ml-2 text-xs text-neutral-400">
            (Phase 2 wires Stripe Connect; this stays &quot;not_implemented&quot; until then.)
          </span>
        </div>
        <div className="mt-3">
          <div>
            Sender: <strong>{row.senderName}</strong> · {row.senderEmail}
          </div>
          <div>
            Transporter: <strong>{row.transporterName}</strong> · {row.transporterEmail}
          </div>
        </div>
        {row.shipmentId && (
          <div className="mt-3">
            <a className="underline" href={`/shipments/${row.shipmentId}`}>
              View shipment
            </a>
          </div>
        )}
        {row.capacityOfferId && (
          <div className="mt-1">
            <a className="underline" href={`/capacity/${row.capacityOfferId}`}>
              View capacity offer
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
