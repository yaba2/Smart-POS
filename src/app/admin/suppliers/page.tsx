import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/actions/settings";
import { SuppliersClient } from "@/components/admin/suppliers-client";
import { Permission } from "@prisma/client";

export default async function SuppliersPage() {
  const session = await requireAdmin();
  const canManage =
    !!session.permissions?.includes(Permission.MANAGE_EXPENSES) ||
    !!session.permissions?.includes(Permission.MANAGE_SETTINGS);
  const settings = await getSettings();

  return (
    <main className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Suppliers & Accounts</h1>
        <p className="text-sm text-gray-500">Manage suppliers and track payments</p>
      </div>
      <SuppliersClient currencySymbol={settings?.currencySymbol || "$"} canManage={canManage} />
    </main>
  );
}
