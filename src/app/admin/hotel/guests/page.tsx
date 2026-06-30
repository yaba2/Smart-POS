import { requireAdmin } from "@/lib/auth";
import { getGuests } from "@/actions/hotel/guests";
import { GuestsClient } from "@/components/admin/hotel/guests-client";
import { Permission } from "@prisma/client";

export default async function HotelGuestsPage() {
  const session = await requireAdmin();
  const canManage = session.role === "ADMIN" || !!session.permissions?.includes(Permission.MANAGE_HOTEL_GUESTS);
  const { guests = [] } = await getGuests();

  return (
    <main className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Hotel Guests</h1>
        <p className="text-sm text-gray-500">Manage guest profiles and VIP tiers</p>
      </div>
      <GuestsClient guests={guests} canManage={canManage} />
    </main>
  );
}
