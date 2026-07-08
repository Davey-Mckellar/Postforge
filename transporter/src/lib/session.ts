import { auth } from "@/lib/auth";

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}
