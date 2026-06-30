import { requireAdmin } from "@/lib/auth";
import { getRoomServices } from "@/actions/hotel/room-services";
import { RoomServicesClient } from "@/components/admin/hotel/room-services-client";
import { Permission } from "@prisma/client";

export default async function HotelRoomServicesPage() {
  const session = await requireAdmin();
  const canManage = session.role === "ADMIN" || !!session.permissions?.includes(Permission.MANAGE_HOTEL_SERVICES);
  const { services = [] } = await getRoomServices();

  return (
    <main className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Room Services (KDS)</h1>
        <p className="text-sm text-gray-500">Kitchen display queue and delivery tracking</p>
      </div>
      <RoomServicesClient services={services} canManage={canManage} />
    </main>
  );
}
