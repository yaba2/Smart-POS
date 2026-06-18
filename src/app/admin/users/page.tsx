import { requireStrictAdmin } from "@/lib/auth";
import { getUsers } from "@/actions/users";
import { UsersClient } from "@/components/admin/users-client";

export default async function UsersPage() {
  await requireStrictAdmin();
  const users = await getUsers();
  return <UsersClient users={users} />;
}
