import { requireAdmin } from "@/lib/auth";
import { getHotelAnalytics } from "@/actions/hotel/analytics";
import { HotelAnalyticsClient } from "@/components/admin/hotel/analytics-client";
import { Permission } from "@prisma/client";

export default async function HotelAnalyticsPage() {
  const session = await requireAdmin();
  const canView = session.role === "ADMIN" || !!session.permissions?.includes(Permission.VIEW_HOTEL_ANALYTICS);
  const { analytics } = await getHotelAnalytics(30);

  return (
    <main className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Hotel Analytics</h1>
        <p className="text-sm text-gray-500">Occupancy, revenue, and service metrics</p>
      </div>
      <HotelAnalyticsClient analytics={analytics} canView={canView} />
    </main>
  );
}
