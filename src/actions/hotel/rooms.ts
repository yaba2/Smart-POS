"use server";

import { prisma } from "@/lib/prisma";
import { RoomStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

function parseRoomForm(formData: FormData) {
  const number = String(formData.get("number") || "").trim();
  const floor = Number(formData.get("floor") || "1");
  const type = String(formData.get("type") || "").trim();
  const basePrice = Number(formData.get("basePrice") || "0");
  const dynamicPrice = Number(formData.get("dynamicPrice") || "0");
  const status = String(formData.get("status") || "AVAILABLE") as RoomStatus;
  const notes = String(formData.get("notes") || "").trim() || null;
  const active = formData.get("active") === "true" || formData.get("active") === "on";

  if (!number) return { error: "Room number is required" };
  if (!Number.isInteger(floor) || floor < 1) return { error: "Floor must be a positive integer" };
  if (!type) return { error: "Room type is required" };
  if (Number.isNaN(basePrice) || basePrice < 0) return { error: "Base price must be a positive number" };
  if (Number.isNaN(dynamicPrice) || dynamicPrice < 0) return { error: "Dynamic price must be a positive number" };

  return { data: { number, floor, type, basePrice, dynamicPrice, status, notes, active } };
}

export async function getRooms() {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: [{ floor: "asc" }, { number: "asc" }],
      include: {
        stays: {
          where: {
            status: { in: ["UPCOMING", "CHECKED_IN"] },
          },
          include: { guest: true },
          orderBy: { scheduledCheckOut: "desc" },
          take: 1,
        },
      },
    });
    return { rooms };
  } catch (e) {
    return { error: "Failed to load rooms" };
  }
}

export async function getRoomById(id: string) {
  try {
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        stays: {
          include: { guest: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
    return { room };
  } catch (e) {
    return { error: "Failed to load room" };
  }
}

export async function createRoom(formData: FormData) {
  const parsed = parseRoomForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    const existing = await prisma.room.findUnique({
      where: { number: parsed.data.number },
    });
    if (existing) return { error: "Room number already exists" };

    const room = await prisma.room.create({
      data: {
        ...parsed.data,
        dynamicPrice: parsed.data.dynamicPrice || parsed.data.basePrice,
      },
    });
    revalidatePath("/admin/hotel/rooms");
    return { success: true, room };
  } catch (e) {
    return { error: "Failed to create room" };
  }
}

export async function updateRoom(id: string, formData: FormData) {
  const parsed = parseRoomForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    const room = await prisma.room.update({
      where: { id },
      data: {
        ...parsed.data,
        dynamicPrice: parsed.data.dynamicPrice || parsed.data.basePrice,
      },
    });
    revalidatePath("/admin/hotel/rooms");
    return { success: true, room };
  } catch (e) {
    return { error: "Failed to update room" };
  }
}

export async function updateRoomStatus(id: string, status: RoomStatus) {
  try {
    const room = await prisma.room.update({
      where: { id },
      data: { status },
    });
    revalidatePath("/admin/hotel/rooms");
    return { success: true, room };
  } catch (e) {
    return { error: "Failed to update room status" };
  }
}

export async function deleteRoom(id: string) {
  try {
    await prisma.room.delete({ where: { id } });
    revalidatePath("/admin/hotel/rooms");
    return { success: true };
  } catch (e) {
    return { error: "Failed to delete room" };
  }
}
