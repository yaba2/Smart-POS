import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/actions/settings";
import { BalanceSheetClient } from "@/components/admin/balance-sheet-client";

export default async function BalanceSheetPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Balance Sheet</h1>
        <p className="text-sm text-gray-500">Cash-on-hand, accounts payable, and net profit overview</p>
      </div>
      <BalanceSheetClient currencySymbol={settings?.currencySymbol || "$"} />
    </main>
  );
}
