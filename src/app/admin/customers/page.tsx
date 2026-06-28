import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/actions/settings";
import { CustomersClient } from "@/components/admin/customers-client";
import { Permission } from "@prisma/client";

export default async function CustomersPage() {
  const session = await requireAdmin();
  const canManage =
    !!session.permissions?.includes(Permission.MANAGE_CUSTOMERS) ||
    !!session.permissions?.includes(Permission.MANAGE_SETTINGS);
  const settings = await getSettings();

  return (
    <main className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-500">Manage customers and their credit limits</p>
      </div>
      <CustomersClient currencySymbol={settings?.currencySymbol || "$"} canManage={canManage} />
    </main>
  );
}
