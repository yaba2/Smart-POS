import { getSession } from "@/lib/session";
import { getSettings } from "@/actions/settings";
import { PosHeader } from "@/components/pos/pos-header";
import { PWAInstallPrompt } from "@/components/pwa-install";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return <>{children}</>;
  }

  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PosHeader
        waiterName={session.name || ""}
        restaurantName={settings.restaurantName}
        permissions={session.permissions || []}
        role={session.role}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
      <PWAInstallPrompt />
    </div>
  );
}
