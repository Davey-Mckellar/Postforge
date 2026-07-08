import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { capacityOffers } from "@/lib/db/schema";

async function createCapacity(formData: FormData) {
  "use server";
  const user = await requireSessionUser();
  const origin = String(formData.get("origin") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim();
  if (!origin || !destination) throw new Error("origin_and_destination_required");

  const capacityKg = str(formData.get("capacityKg"));
  const askingPrice = str(formData.get("askingPrice"));

  const [created] = await db
    .insert(capacityOffers)
    .values({
      transporterId: user.id,
      origin,
      destination,
      capacityKg,
      askingPrice,
    })
    .returning({ id: capacityOffers.id });

  revalidatePath("/");
  redirect(`/capacity/${created.id}`);
}

function str(v: FormDataEntryValue | null): string | undefined {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
}

export default async function NewCapacityPage() {
  await requireSessionUser();
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">Post capacity</h1>
      <form action={createCapacity} className="space-y-3">
        <Field label="Origin" name="origin" required />
        <Field label="Destination" name="destination" required />
        <Field label="Capacity (kg)" name="capacityKg" />
        <Field label="Asking price ($)" name="askingPrice" />
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white hover:bg-neutral-800"
        >
          Post capacity
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
