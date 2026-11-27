import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  return new Response(null, { status: user ? 204 : 401 });
}
