import { getSession } from "@/lib/session";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getSettings } from "@/actions/settings";
import { PWAInstallPrompt } from "@/components/pwa-install";

const BACKEND_ROLES = ["ADMIN", "MANAGER", "SUPERVISOR"];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Only show sidebar for backend roles (ADMIN, MANAGER, SUPERVISOR)
  if (!session.isLoggedIn || !BACKEND_ROLES.includes(session.role || "")) {
    return <>{children}</>;
  }

  const settings = await getSettings();

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <AdminSidebar 
        adminName={session.name || ""} 
        restaurantName={settings.restaurantName} 
        role={session.role || ""} 
        permissions={session.permissions || []}
      />
      <main className="flex-1 overflow-auto">{children}</main>
      <PWAInstallPrompt />
    </div>
  );
}
