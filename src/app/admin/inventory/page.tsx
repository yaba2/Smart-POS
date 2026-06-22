import { requireAdmin } from "@/lib/auth";
import { getInventoryItems, getRequisitions, getInventoryStats, getTransactions } from "@/actions/inventory";
import { getSuppliers } from "@/actions/suppliers";
import { InventoryClient } from "@/components/admin/inventory-client";
import { getSettings } from "@/actions/settings";

export default async function InventoryPage() {
  await requireAdmin();
  const [items, requisitions, stats, transactions, suppliersResult, settings] = await Promise.all([
    getInventoryItems(),
    getRequisitions(),
    getInventoryStats(),
    getTransactions(undefined, 100),
    getSuppliers(),
    getSettings(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSuppliers = suppliersResult as any;
  const suppliers: { id: string; name: string }[] = rawSuppliers.error
    ? []
    : (rawSuppliers.suppliers ?? rawSuppliers).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }));

  return (
    <InventoryClient
      initialItems={items}
      initialRequisitions={requisitions}
      initialStats={stats}
      initialTransactions={transactions}
      suppliers={suppliers}
      currencySymbol={settings?.currencySymbol ?? "$"}
    />
  );
}
