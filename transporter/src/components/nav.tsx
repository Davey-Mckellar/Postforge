import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { signOut } from "@/lib/auth";

export default async function Nav() {
  const user = await getSessionUser();
  return (
    <header className="border-b border-neutral-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 text-sm">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold">
            Transporter
          </Link>
          <Link href="/shipments/new" className="text-neutral-700 hover:text-black">
            Post shipment
          </Link>
          <Link href="/capacity/new" className="text-neutral-700 hover:text-black">
            Post capacity
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-neutral-500">
                {user.name} ({user.role})
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/signin" className="text-neutral-700 hover:text-black">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded bg-black px-3 py-1 text-white hover:bg-neutral-800"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
