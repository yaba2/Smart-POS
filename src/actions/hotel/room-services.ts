"use server";

import { prisma } from "@/lib/prisma";
import { RoomServiceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getRoomServices(status?: RoomServiceStatus) {
  try {
    const where = status ? { status } : {};
    const services = await prisma.roomService.findMany({
      where,
      orderBy: [{ priority: "desc" }, { orderedAt: "asc" }],
      include: {
        room: true,
        stay: { include: { guest: true } },
      },
    });
    return { services };
  } catch (e) {
    return { error: "Failed to load room services" };
  }
}

export async function createRoomService(stayId: string, roomId: string, items: any[], deadline?: Date) {
  try {
    const stay = await prisma.stay.findUnique({
      where: { id: stayId },
      include: { guest: true, room: true },
    });
    if (!stay) return { error: "Stay not found" };
    if (stay.status !== "CHECKED_IN") return { error: "Guest is not checked in" };
    if (stay.roomId !== roomId && stay.roomId) {
      const currentRoom = await prisma.room.findUnique({ where: { id: stay.roomId } });
      if (currentRoom && currentRoom.status !== "AVAILABLE") {
        return { error: "Stay room mismatch" };
      }
    }

    const total = items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
    const deliveryDeadline = deadline || stay.scheduledCheckOut;

    const service = await prisma.$transaction(async (tx) => {
      const created = await tx.roomService.create({
        data: {
          stayId,
          roomId,
          orderItems: items as any,
          total,
          deadline: deliveryDeadline,
          priority: getPriority(stay.guest.vipTier),
        },
      });
      await tx.folioItem.create({
        data: {
          stayId,
          type: "CHARGE",
          category: "FB",
          description: `Room service ${created.id.slice(0, 6)}`,
          amount: total,
          isRoomBill: false,
        },
      });
      return created;
    });

    revalidatePath("/admin/hotel/room-services");
    revalidatePath("/admin/hotel/stays");
    return { success: true, service };
  } catch (e) {
    return { error: "Failed to create room service" };
  }
}

function getPriority(vipTier: string) {
  switch (vipTier) {
    case "PLATINUM": return 4;
    case "GOLD": return 3;
    case "SILVER": return 2;
    default: return 1;
  }
}

export async function updateRoomServiceStatus(id: string, status: RoomServiceStatus) {
  try {
    const data: any = { status };
    if (status === "PREPARING") data.preparingAt = new Date();
    if (status === "IN_TRANSIT") data.inTransitAt = new Date();
    if (status === "DELIVERED") data.deliveredAt = new Date();

    const service = await prisma.roomService.update({
      where: { id },
      data,
    });
    revalidatePath("/admin/hotel/room-services");
    return { success: true, service };
  } catch (e) {
    return { error: "Failed to update service status" };
  }
}

export async function deleteRoomService(id: string) {
  try {
    await prisma.roomService.delete({ where: { id } });
    revalidatePath("/admin/hotel/room-services");
    return { success: true };
  } catch (e) {
    return { error: "Failed to delete room service" };
  }
}
