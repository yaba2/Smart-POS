import { requireAdmin } from "@/lib/auth";
import { getRooms } from "@/actions/hotel/rooms";
import { RoomsClient } from "@/components/admin/hotel/rooms-client";
import { Permission } from "@prisma/client";

export default async function HotelRoomsPage() {
  const session = await requireAdmin();
  const canManage = session.role === "ADMIN" || !!session.permissions?.includes(Permission.MANAGE_HOTEL_ROOMS);
  const { rooms = [] } = await getRooms();

  return (
    <main className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Hotel Rooms</h1>
        <p className="text-sm text-gray-500">Manage rooms, housekeeping, and floor map</p>
      </div>
      <RoomsClient rooms={rooms} canManage={canManage} />
    </main>
  );
}
