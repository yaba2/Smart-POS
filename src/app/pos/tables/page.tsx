import { getTables } from "@/actions/tables";
import { requireWaiter } from "@/lib/auth";
import { getAnyOpenShift } from "@/actions/shifts";
import { getSettings } from "@/actions/settings";
import { TablesClient } from "@/components/pos/tables-client";

export default async function TablesPage() {
  const session = await requireWaiter();
  const canBypass = session.role === "ADMIN" || session.role === "MANAGER" || session.role === "SUPERVISOR";

  // Fetch from DB; if offline, fall back to empty props — IndexedDB in TablesClient takes over
  let tables: Awaited<ReturnType<typeof getTables>> = [];
  let anyShift: Awaited<ReturnType<typeof getAnyOpenShift>> = null;
  let currencySymbol = "$";

  try {
    const [t, s, settings] = await Promise.all([getTables(), getAnyOpenShift(), getSettings()]);
    tables = t;
    anyShift = s;
    currencySymbol = settings.currencySymbol;
  } catch {
    // DB unreachable (offline) — TablesClient will load from IndexedDB
  }

  return (
    <TablesClient
      tables={tables}
      waiterId={session.userId || ""}
      hasOpenShift={!!anyShift}
      openedByName={anyShift?.user?.name ?? null}
      canBypassShift={canBypass}
      currencySymbol={currencySymbol}
    />
  );
}
