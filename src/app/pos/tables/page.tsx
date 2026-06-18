import { getTables } from "@/actions/tables";
import { requireWaiter } from "@/lib/auth";
import { getAnyOpenShift } from "@/actions/shifts";
import { getSettings } from "@/actions/settings";
import { TablesClient } from "@/components/pos/tables-client";

export default async function TablesPage() {
  const session = await requireWaiter();
  const [tables, anyShift, settings] = await Promise.all([getTables(), getAnyOpenShift(), getSettings()]);
  const canBypass = session.role === "ADMIN" || session.role === "MANAGER" || session.role === "SUPERVISOR";

  return (
    <TablesClient
      tables={tables}
      waiterId={session.userId || ""}
      hasOpenShift={!!anyShift}
      openedByName={anyShift?.user?.name ?? null}
      canBypassShift={canBypass}
      currencySymbol={settings.currencySymbol}
    />
  );
}
