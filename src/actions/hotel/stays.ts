"use server";

import { prisma } from "@/lib/prisma";
import { BookingSource, RoomStatus, StayStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

const BOOKING_SOURCES = ["WALK_IN", "OTA", "WEB"];

function parseStayForm(formData: FormData) {
  const roomId = String(formData.get("roomId") || "").trim();
  const guestId = String(formData.get("guestId") || "").trim();
  const bookingSource = String(formData.get("bookingSource") || "WALK_IN");
  const scheduledCheckIn = String(formData.get("scheduledCheckIn") || "").trim();
  const scheduledCheckOut = String(formData.get("scheduledCheckOut") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!roomId) return { error: "Room is required" };
  if (!guestId) return { error: "Guest is required" };
  if (!BOOKING_SOURCES.includes(bookingSource)) return { error: "Invalid booking source" };
  if (!scheduledCheckIn) return { error: "Check-in date is required" };

  const checkIn = new Date(scheduledCheckIn);
  if (Number.isNaN(checkIn.getTime())) return { error: "Invalid check-in date" };

  // Check-out is optional at booking (open-ended stay)
  let checkOut: Date | null = null;
  if (scheduledCheckOut) {
    checkOut = new Date(scheduledCheckOut);
    if (Number.isNaN(checkOut.getTime())) return { error: "Invalid check-out date" };
    if (checkOut <= checkIn) return { error: "Check-out must be after check-in" };
  }

  return { data: { roomId, guestId, bookingSource: bookingSource as BookingSource, checkIn, checkOut, notes } };
}

export async function getStays(status?: StayStatus) {
  try {
    const where = status ? { status } : {};
    const stays = await prisma.stay.findMany({
      where,
      orderBy: { scheduledCheckIn: "desc" },
      include: {
        room: true,
        guest: true,
        folioItems: true,
        services: { orderBy: { orderedAt: "desc" }, take: 3 },
      },
    });
    return { stays };
  } catch (e) {
    return { error: "Failed to load stays" };
  }
}

export async function getStayById(id: string) {
  try {
    const stay = await prisma.stay.findUnique({
      where: { id },
      include: {
        room: true,
        guest: true,
        folioItems: { orderBy: { postedAt: "desc" } },
        services: {
          orderBy: { orderedAt: "desc" },
          include: { room: true },
        },
      },
    });
    return { stay };
  } catch (e) {
    return { error: "Failed to load stay" };
  }
}

export async function createStay(formData: FormData) {
  const parsed = parseStayForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    const room = await prisma.room.findUnique({
      where: { id: parsed.data.roomId },
    });
    if (!room) return { error: "Room not found" };
    if (room.status !== RoomStatus.AVAILABLE) return { error: "Room is not available" };

    const guest = await prisma.guest.findUnique({
      where: { id: parsed.data.guestId },
    });
    if (!guest) return { error: "Guest not found" };

    // If check-out is provided at booking time, pre-calculate the room charge
    const nights = parsed.data.checkOut
      ? Math.max(1, Math.ceil((parsed.data.checkOut.getTime() - parsed.data.checkIn.getTime()) / (1000 * 60 * 60 * 24)))
      : null;
    const roomTotal = nights ? nights * room.dynamicPrice : null;

    const stay = await prisma.$transaction(async (tx) => {
      const created = await tx.stay.create({
        data: {
          roomId: parsed.data.roomId,
          guestId: parsed.data.guestId,
          bookingSource: parsed.data.bookingSource,
          scheduledCheckIn: parsed.data.checkIn,
          ...(parsed.data.checkOut ? { scheduledCheckOut: parsed.data.checkOut } : {}),
          status: StayStatus.UPCOMING,
          notes: parsed.data.notes,
        },
      });
      if (nights && roomTotal) {
        await tx.folioItem.create({
          data: {
            stayId: created.id,
            type: "CHARGE",
            category: "ROOM",
            description: `Room ${room.number} — ${nights} night(s) (estimated)`,
            amount: roomTotal,
            isRoomBill: true,
          },
        });
      }
      return created;
    });

    revalidatePath("/admin/hotel/stays");
    revalidatePath("/admin/hotel/rooms");
    return { success: true, stay };
  } catch (e) {
    return { error: "Failed to create stay" };
  }
}

export async function checkInStay(id: string) {
  try {
    const stay = await prisma.stay.findUnique({
      where: { id },
      include: { room: true },
    });
    if (!stay) return { error: "Stay not found" };
    if (stay.status !== StayStatus.UPCOMING) return { error: "Stay is not upcoming" };
    if (stay.room.status !== RoomStatus.AVAILABLE && stay.room.status !== RoomStatus.OCCUPIED) {
      return { error: "Room is not ready for check-in" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.stay.update({
        where: { id },
        data: { status: StayStatus.CHECKED_IN, actualCheckIn: new Date() },
      });
      await tx.room.update({
        where: { id: stay.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });
    });

    revalidatePath("/admin/hotel/stays");
    revalidatePath("/admin/hotel/rooms");
    return { success: true };
  } catch (e) {
    return { error: "Failed to check in" };
  }
}

export async function checkOutStay(id: string, checkOutDate: string) {
  try {
    if (!checkOutDate) return { error: "Check-out date is required" };
    const checkOut = new Date(checkOutDate);
    if (Number.isNaN(checkOut.getTime())) return { error: "Invalid check-out date" };

    const stay = await prisma.stay.findUnique({
      where: { id },
      include: {
        room: true,
        folioItems: true,
        services: { where: { status: { not: "DELIVERED" } } },
      },
    });
    if (!stay) return { error: "Stay not found" };
    if (stay.status !== StayStatus.CHECKED_IN) return { error: "Stay is not checked in" };
    if (checkOut <= (stay.actualCheckIn ?? stay.scheduledCheckIn)) return { error: "Check-out must be after check-in" };

    const undelivered = stay.services.length;
    if (undelivered > 0) return { error: `${undelivered} room service order(s) still pending` };

    // Calculate actual nights from real check-in to chosen check-out
    const actualCheckIn = stay.actualCheckIn ?? stay.scheduledCheckIn;
    const nights = Math.max(1, Math.ceil((checkOut.getTime() - actualCheckIn.getTime()) / (1000 * 60 * 60 * 24)));
    const lateFee = 0;

    await prisma.$transaction(async (tx) => {
      // Remove any estimated room bill and replace with actual
      await tx.folioItem.deleteMany({
        where: { stayId: id, category: "ROOM", isRoomBill: true },
      });
      await tx.folioItem.create({
        data: {
          stayId: id,
          type: "CHARGE",
          category: "ROOM",
          description: `Room ${stay.room.number} — ${nights} night(s)`,
          amount: nights * stay.room.dynamicPrice,
          isRoomBill: true,
          isPaid: false,
        },
      });
      await tx.stay.update({
        where: { id },
        data: { status: StayStatus.CHECKED_OUT, actualCheckOut: checkOut, scheduledCheckOut: checkOut, lateCheckoutFee: lateFee },
      });
      await tx.room.update({
        where: { id: stay.roomId },
        data: { status: RoomStatus.DIRTY },
      });
    });

    revalidatePath("/admin/hotel/stays");
    revalidatePath("/admin/hotel/rooms");
    return { success: true, lateFee };
  } catch (e) {
    return { error: "Failed to check out" };
  }
}

export async function cancelStay(id: string) {
  try {
    const stay = await prisma.stay.findUnique({ where: { id }, include: { room: true } });
    if (!stay) return { error: "Stay not found" };
    if (stay.status === StayStatus.CHECKED_OUT) return { error: "Cannot cancel checked-out stay" };

    await prisma.$transaction(async (tx) => {
      await tx.stay.update({ where: { id }, data: { status: StayStatus.CANCELLED } });
      if (stay.status === StayStatus.CHECKED_IN || stay.room.status === RoomStatus.OCCUPIED) {
        await tx.room.update({ where: { id: stay.roomId }, data: { status: RoomStatus.DIRTY } });
      }
    });

    revalidatePath("/admin/hotel/stays");
    revalidatePath("/admin/hotel/rooms");
    return { success: true };
  } catch (e) {
    return { error: "Failed to cancel stay" };
  }
}

export async function deleteStay(id: string) {
  try {
    await prisma.stay.delete({ where: { id } });
    revalidatePath("/admin/hotel/stays");
    revalidatePath("/admin/hotel/rooms");
    return { success: true };
  } catch (e) {
    return { error: "Failed to delete stay" };
  }
}
