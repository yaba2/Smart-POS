import { requireAdmin } from "@/lib/auth";
import { getStays } from "@/actions/hotel/stays";
import { getRooms } from "@/actions/hotel/rooms";
import { getGuests } from "@/actions/hotel/guests";
import { StaysClient } from "@/components/admin/hotel/stays-client";
import { Permission } from "@prisma/client";

export default async function HotelStaysPage({ searchParams }: { searchParams?: { roomId?: string } }) {
  const session = await requireAdmin();
  const canManage = session.role === "ADMIN" || !!session.permissions?.includes(Permission.MANAGE_HOTEL_STAYS);
  const [{ stays = [] }, { rooms = [] }, { guests = [] }] = await Promise.all([
    getStays(),
    getRooms(),
    getGuests(),
  ]);

  return (
    <main className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Stays & Bookings</h1>
        <p className="text-sm text-gray-500">Check-in, check-out, and reservation management</p>
      </div>
      <StaysClient stays={stays} rooms={rooms} guests={guests} canManage={canManage} defaultRoomId={searchParams?.roomId} />
    </main>
  );
}
