"use server";

import { prisma } from "@/lib/prisma";
import { VipTier } from "@prisma/client";
import { revalidatePath } from "next/cache";

const VIP_TIERS = ["STANDARD", "SILVER", "GOLD", "PLATINUM"];

function parseGuestForm(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const idNumber = String(formData.get("idNumber") || "").trim() || null;
  const idType = String(formData.get("idType") || "").trim() || null;
  const vipTier = String(formData.get("vipTier") || "STANDARD");
  const notes = String(formData.get("notes") || "").trim() || null;
  const active = formData.get("active") === "true" || formData.get("active") === "on";

  if (!fullName) return { error: "Full name is required" };
  if (email && !email.includes("@")) return { error: "Invalid email address" };
  if (!VIP_TIERS.includes(vipTier)) return { error: "Invalid VIP tier" };

  return { data: { fullName, phone, email, idNumber, idType, vipTier: vipTier as VipTier, notes, active } };
}

export async function getGuests() {
  try {
    const guests = await prisma.guest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        stays: {
          where: { status: { in: ["UPCOMING", "CHECKED_IN"] } },
          include: { room: true },
        },
      },
    });
    return { guests };
  } catch (e) {
    return { error: "Failed to load guests" };
  }
}

export async function getGuestById(id: string) {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id },
      include: {
        stays: {
          orderBy: { createdAt: "desc" },
          include: { room: true },
        },
      },
    });
    return { guest };
  } catch (e) {
    return { error: "Failed to load guest" };
  }
}

export async function createGuest(formData: FormData) {
  const parsed = parseGuestForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    const guest = await prisma.guest.create({
      data: {
        ...parsed.data,
      },
    });
    revalidatePath("/admin/hotel/guests");
    revalidatePath("/admin/hotel/stays");
    return { success: true, guest };
  } catch (e) {
    return { error: "Failed to create guest" };
  }
}

export async function updateGuest(id: string, formData: FormData) {
  const parsed = parseGuestForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    const guest = await prisma.guest.update({
      where: { id },
      data: {
        ...parsed.data,
      },
    });
    revalidatePath("/admin/hotel/guests");
    return { success: true, guest };
  } catch (e) {
    return { error: "Failed to update guest" };
  }
}

export async function deleteGuest(id: string) {
  try {
    await prisma.guest.delete({ where: { id } });
    revalidatePath("/admin/hotel/guests");
    return { success: true };
  } catch (e) {
    return { error: "Failed to delete guest" };
  }
}
