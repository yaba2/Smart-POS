import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/actions/settings";
import { ReportsClient } from "@/components/admin/reports-client";

export default async function ReportsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return <ReportsClient currencySymbol={settings.currencySymbol} />;
}
