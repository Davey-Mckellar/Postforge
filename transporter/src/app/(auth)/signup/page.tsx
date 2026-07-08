import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { signIn } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["sender", "transporter", "both"]),
});

async function signup(formData: FormData) {
  "use server";
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    role: formData.get("role"),
  });
  if (!parsed.success) throw new Error("invalid_input");
  const { email, password, name, role } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new Error("email_in_use");

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ email, passwordHash, name, role });

  await signIn("credentials", { email, password, redirectTo: "/" });
  redirect("/");
}

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-semibold">Sign up</h1>
      <form action={signup} className="space-y-3">
        <Field label="Name" name="name" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Password" name="password" type="password" required />
        <div>
          <label className="block text-sm font-medium">Role</label>
          <select
            name="role"
            defaultValue="both"
            className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1"
          >
            <option value="sender">Sender</option>
            <option value="transporter">Transporter</option>
            <option value="both">Both</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white hover:bg-neutral-800"
        >
          Create account
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1"
      />
    </div>
  );
}
