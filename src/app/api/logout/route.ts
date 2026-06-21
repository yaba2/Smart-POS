import { logout } from "@/actions/auth";

export async function POST() {
  await logout();
  return new Response(null, { status: 204 });
}
