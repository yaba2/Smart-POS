"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getFolioItems(stayId: string) {
  try {
    const items = await prisma.folioItem.findMany({
      where: { stayId },
      orderBy: { postedAt: "desc" },
    });
    return { items };
  } catch (e) {
    return { error: "Failed to load folio" };
  }
}

export async function addFolioCharge(stayId: string, category: string, description: string, amount: number, isRoomBill = true) {
  try {
    const item = await prisma.folioItem.create({
      data: {
        stayId,
        type: "CHARGE",
        category,
        description,
        amount,
        isRoomBill,
      },
    });
    revalidatePath("/admin/hotel/folios");
    revalidatePath("/admin/hotel/stays");
    return { success: true, item };
  } catch (e) {
    return { error: "Failed to add charge" };
  }
}

export async function addFolioPayment(stayId: string, amount: number, description?: string) {
  try {
    const stay = await prisma.stay.findUnique({
      where: { id: stayId },
      include: { folioItems: true },
    });
    if (!stay) return { error: "Stay not found" };
    const balance = stay.folioItems.reduce((sum, f) => sum + (f.type === "CHARGE" ? f.amount : -f.amount), 0);
    if (amount > balance) return { error: "Payment exceeds folio balance" };

    const item = await prisma.$transaction(async (tx) => {
      const payment = await tx.folioItem.create({
        data: {
          stayId,
          type: "PAYMENT",
          category: "PAYMENT",
          description: description || "Payment",
          amount,
          isRoomBill: true,
          isPaid: true,
          paidAt: new Date(),
        },
      });
      const charges = await tx.folioItem.findMany({ where: { stayId, type: "CHARGE", isPaid: false } });
      let remaining = amount;
      for (const charge of charges) {
        if (remaining <= 0) break;
        if (charge.amount <= remaining) {
          await tx.folioItem.update({ where: { id: charge.id }, data: { isPaid: true, paidAt: new Date() } });
          remaining -= charge.amount;
        } else {
          remaining = 0;
        }
      }
      return payment;
    });

    revalidatePath("/admin/hotel/folios");
    revalidatePath("/admin/hotel/stays");
    return { success: true, item };
  } catch (e) {
    return { error: "Failed to add payment" };
  }
}

export async function getCheckoutInvoice(stayId: string) {
  try {
    const stay = await prisma.stay.findUnique({
      where: { id: stayId },
      include: {
        room: true,
        guest: true,
        folioItems: true,
        services: { include: { room: true } },
      },
    });
    if (!stay) return { error: "Stay not found" };

    const roomCharges = stay.folioItems.filter((f) => f.type === "CHARGE" && f.isRoomBill);
    const incidentalCharges = stay.folioItems.filter((f) => f.type === "CHARGE" && !f.isRoomBill);
    const payments = stay.folioItems.filter((f) => f.type === "PAYMENT");
    const roomTotal = roomCharges.reduce((sum, f) => sum + f.amount, 0);
    const incidentalTotal = incidentalCharges.reduce((sum, f) => sum + f.amount, 0);
    const paidTotal = payments.reduce((sum, f) => sum + f.amount, 0);
    const balance = roomTotal + incidentalTotal - paidTotal;

    return {
      success: true,
      invoice: {
        stay,
        roomCharges,
        incidentalCharges,
        payments,
        roomTotal,
        incidentalTotal,
        paidTotal,
        balance,
      },
    };
  } catch (e) {
    return { error: "Failed to generate invoice" };
  }
}
