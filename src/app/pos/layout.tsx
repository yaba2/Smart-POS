import { getSession } from "@/lib/session";
import { getSettings } from "@/actions/settings";
import { PosHeader } from "@/components/pos/pos-header";
import { PWAInstallPrompt } from "@/components/pwa-install";
import { PWAAutoLogout } from "@/components/pwa-auto-logout";
import { PosSyncProvider } from "@/components/pos/pos-sync-provider";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return <>{children}</>;
  }

  let restaurantName = "POS";
  try {
    const settings = await getSettings();
    restaurantName = settings.restaurantName;
  } catch {
    // DB unreachable (offline) — use default name
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PosHeader
        waiterName={session.name || ""}
        restaurantName={restaurantName}
        permissions={session.permissions || []}
        role={session.role}
      />
      <PosSyncProvider>
        <main className="flex-1 overflow-hidden">{children}</main>
      </PosSyncProvider>
      <PWAInstallPrompt />
      <PWAAutoLogout />
    </div>
  );
}
