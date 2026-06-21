import { requireAdmin } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { getSettings } from "@/actions/settings";
import { ExpensesClient } from "@/components/admin/expenses-client";
import { Permission } from "@prisma/client";

export default async function ExpensesPage() {
  await requireAdmin();
  const session = await getSession();
  const settings = await getSettings();

  const canManage =
    session.permissions?.includes(Permission.MANAGE_EXPENSES) ||
    session.permissions?.includes(Permission.MANAGE_SETTINGS) ||
    false;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <p className="text-sm text-gray-500">Record, track, and manage daily restaurant expenses</p>
      </div>
      <ExpensesClient currencySymbol={settings.currencySymbol} canManage={canManage} />
    </div>
  );
}
