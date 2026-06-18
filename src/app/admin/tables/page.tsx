import { requireAdmin } from "@/lib/auth";
import { getTables } from "@/actions/tables";
import { TablesAdminClient } from "@/components/admin/tables-admin-client";

export default async function AdminTablesPage() {
  await requireAdmin();
  const tables = await getTables();
  return <TablesAdminClient tables={tables} />;
}
