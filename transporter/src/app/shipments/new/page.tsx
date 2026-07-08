import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { shipments } from "@/lib/db/schema";

async function createShipment(formData: FormData) {
  "use server";
  const user = await requireSessionUser();
  const origin = String(formData.get("origin") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim();
  if (!origin || !destination) throw new Error("origin_and_destination_required");

  const cargoDescription = str(formData.get("cargoDescription"));
  const weightKg = str(formData.get("weightKg"));
  const declaredValue = str(formData.get("declaredValue"));
  const targetPrice = str(formData.get("targetPrice"));

  const [created] = await db
    .insert(shipments)
    .values({
      senderId: user.id,
      origin,
      destination,
      cargoDescription,
      weightKg,
      declaredValue,
      targetPrice,
    })
    .returning({ id: shipments.id });

  revalidatePath("/");
  redirect(`/shipments/${created.id}`);
}

function str(v: FormDataEntryValue | null): string | undefined {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
}

export default async function NewShipmentPage() {
  await requireSessionUser();
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">Post a shipment</h1>
      <form action={createShipment} className="space-y-3">
        <Field label="Origin" name="origin" required />
        <Field label="Destination" name="destination" required />
        <Field label="Cargo description" name="cargoDescription" />
        <Field label="Weight (kg)" name="weightKg" />
        <Field label="Declared value ($)" name="declaredValue" />
        <Field label="Target price ($)" name="targetPrice" />
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white hover:bg-neutral-800"
        >
          Post shipment
        </button>
      </form>
    </div>
  );
}

function Field({ label, name, required }: { label: string; name: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        name={name}
        required={required}
        className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1"
      />
    </div>
  );
}
