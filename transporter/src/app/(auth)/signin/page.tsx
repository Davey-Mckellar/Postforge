import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

async function signin(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  await signIn("credentials", { email, password, redirectTo: "/" });
  redirect("/");
}

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-semibold">Sign in</h1>
      <form action={signin} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            name="password"
            type="password"
            required
            className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white hover:bg-neutral-800"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
