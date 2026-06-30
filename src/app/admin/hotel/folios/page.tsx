import { requireAdmin } from "@/lib/auth";
import { getStays } from "@/actions/hotel/stays";
import { FoliosClient } from "@/components/admin/hotel/folios-client";
import { Permission } from "@prisma/client";

export default async function HotelFoliosPage() {
  const session = await requireAdmin();
  const canManage =
    session.role === "ADMIN" ||
    !!session.permissions?.includes(Permission.MANAGE_HOTEL_STAYS) ||
    !!session.permissions?.includes(Permission.MANAGE_HOTEL_SERVICES);
  const { stays = [] } = await getStays();

  return (
    <main className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Guest Folios</h1>
        <p className="text-sm text-gray-500">Room bills, charges, payments, and checkout invoices</p>
      </div>
      <FoliosClient stays={stays} canManage={canManage} />
    </main>
  );
}
