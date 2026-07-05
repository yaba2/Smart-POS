"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ShiftType } from "@prisma/client";
import { revalidatePath } from "next/cache";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function openShift(openingCash: number, shiftType: ShiftType) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  try {
    const anyOpenShift = await prisma.shift.findFirst({ where: { closedAt: null } });
    if (anyOpenShift) return { success: true, shift: anyOpenShift, alreadyOpen: true };

    const { start, end } = todayRange();
    const todayShifts = await prisma.shift.findMany({
      where: { openedAt: { gte: start, lte: end }, closedAt: { not: null } },
    });

    const morningDone = todayShifts.some((s) => s.shiftType === "MORNING");
    const eveningDone = todayShifts.some((s) => s.shiftType === "EVENING");

    if (morningDone && eveningDone) {
      const shift = await prisma.shift.create({
        data: { userId: session.userId, openingCash, shiftType, notes: "Next day shift (both previous shifts completed)" },
      });
      revalidatePath("/pos/shift");
      return { success: true, shift, nextDay: true };
    }

    const doneToday = todayShifts.some((s) => s.shiftType === shiftType);
    if (doneToday) {
      return { error: `The ${shiftType.toLowerCase()} shift has already been completed today. Both shifts must be completed to start a new cycle.` };
    }

    const shift = await prisma.shift.create({
      data: { userId: session.userId, openingCash, shiftType },
    });
    revalidatePath("/pos/shift");
    return { success: true, shift };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

export async function closeShift(closingCash: number, notes?: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  try {
    const shift = await prisma.shift.findFirst({ where: { closedAt: null }, orderBy: { openedAt: "desc" } });
    if (!shift) return { error: "No open shift found" };

    await prisma.order.deleteMany({ where: { status: "OPEN", orderItems: { none: {} } } });

    const unclearedCount = await prisma.order.count({ where: { status: { in: ["SENT", "WAITING_PAYMENT"] } } });
    const openWithItems = await prisma.order.count({ where: { status: "OPEN", orderItems: { some: {} } } });
    const total = unclearedCount + openWithItems;
    if (total > 0) {
      return { error: `Cannot close shift: ${total} order(s) still have unpaid bills. Clear all bills first.` };
    }

    const closed = await prisma.shift.update({
      where: { id: shift.id },
      data: { closedAt: new Date(), closingCash, notes },
    });
    revalidatePath("/pos/shift");
    return { success: true, shift: closed };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

export async function getCurrentShift() {
  try {
    return await prisma.shift.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: "desc" },
    });
  } catch {
    return null;
  }
}

// System-wide: any open shift = POS is unlocked for ALL users
export async function getAnyOpenShift() {
  try {
    return await prisma.shift.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: "desc" },
      include: { user: true },
    });
  } catch {
    return null;
  }
}

export async function getShiftReport(shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { user: true },
  });
  if (!shift) return null;

  const periodEnd = shift.closedAt || new Date();

  // Get ALL payments within this shift's time range
  // This includes:
  // 1. Payments with matching shiftId
  // 2. Payments without shiftId (legacy) that fall within time range
  // 3. Any other payments that happened during this shift period
  const allShiftPayments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: shift.openedAt, lte: periodEnd },
    },
  });

  // Get unique order IDs that have payments in this shift
  const orderIds = Array.from(new Set(allShiftPayments.map(p => p.orderId)));

  // Fetch orders that have payments in this shift
  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      status: "COMPLETED",
    },
    include: {
      orderItems: { include: { menuItem: { include: { category: true } } } },
      table: true,
      waiter: true,
      payments: { where: { createdAt: { gte: shift.openedAt, lte: periodEnd } } },
    },
    orderBy: { paidAt: "asc" },
  });

  // Calculate totals from this shift's payments only
  const totalSales = allShiftPayments.reduce((s, p) => s + p.amount, 0);
  const orderCount = orders.length;

  // Aggregate by payment method - only from this shift's payments
  const byMethod: Record<string, { count: number; total: number }> = {};
  const byWaiter: Record<string, { name: string; count: number; total: number }> = {};
  const byCategory: Record<string, { name: string; qty: number; total: number }> = {};
  const byItem: Record<string, { name: string; category: string; qty: number; total: number }> = {};

  // Aggregate payment methods from shift payments
  for (const payment of allShiftPayments) {
    const m = payment.method;
    if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
    byMethod[m].count++;
    byMethod[m].total += payment.amount;
  }

  for (const order of orders) {
    const wId = order.waiterId;
    if (!byWaiter[wId]) byWaiter[wId] = { name: order.waiter.name, count: 0, total: 0 };
    byWaiter[wId].count++;
    byWaiter[wId].total += order.total;

    for (const item of order.orderItems) {
      const catName = item.menuItem.category.name;
      const catId = item.menuItem.categoryId;
      if (!byCategory[catId]) byCategory[catId] = { name: catName, qty: 0, total: 0 };
      byCategory[catId].qty += item.quantity;
      byCategory[catId].total += item.price * item.quantity;

      const mId = item.menuItemId;
      if (!byItem[mId]) byItem[mId] = { name: item.menuItem.name, category: catName, qty: 0, total: 0 };
      byItem[mId].qty += item.quantity;
      byItem[mId].total += item.price * item.quantity;
    }
  }

  // Get cancelled orders that were SENT to kitchen (not included in sales totals)
  // Only record cancellations if order was actually sent (sentAt !== null)
  const cancelledOrders = await prisma.order.findMany({
    where: {
      status: "CANCELLED",
      sentAt: { not: null }, // Only orders that were sent to kitchen
      cancelledAt: { gte: shift.openedAt, lte: periodEnd },
    },
    include: {
      orderItems: { include: { menuItem: true } },
      table: true,
      waiter: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  const cancelledTotal = cancelledOrders.reduce((s, o) => s + o.total, 0);
  const cancelledCount = cancelledOrders.length;

  return {
    shift,
    totalSales,
    orderCount,
    byMethod,
    byWaiter: Object.values(byWaiter).sort((a, b) => b.total - a.total),
    byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    byItem: Object.values(byItem).sort((a, b) => b.qty - a.qty),
    orders,
    cancelledOrders,
    cancelledTotal,
    cancelledCount,
  };
}

export async function getMyShifts() {
  const session = await getSession();
  if (!session.userId) return [];

  // Return ALL shifts (shared across all users) for reporting
  return prisma.shift.findMany({
    where: {},
    orderBy: { openedAt: "desc" },
    take: 30,
    include: { user: true },
  });
}

export async function getDailyReport(dateStr: string, utcOffsetMinutes = 0, toDateStr?: string) {
  // Build UTC-correct boundaries for a date (or date range) given the client's UTC offset.
  // dayStart = fromDate 00:00 local  →  fromDate T00:00Z shifted back by offset
  // dayEnd   = toDate   23:59 local  →  toDate   T23:59Z shifted back by offset
  const endDateStr = toDateStr ?? dateStr;
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  dayStart.setUTCMinutes(dayStart.getUTCMinutes() - utcOffsetMinutes);
  const dayEnd = new Date(`${endDateStr}T23:59:59.999Z`);
  dayEnd.setUTCMinutes(dayEnd.getUTCMinutes() - utcOffsetMinutes);

  const shifts = await prisma.shift.findMany({
    where: { openedAt: { gte: dayStart, lte: dayEnd } },
    include: { user: true, payments: true },
    orderBy: { openedAt: "asc" },
  });

  // Get all payments for this day across all shifts (with shift info)
  const allPayments = await prisma.payment.findMany({
    where: { createdAt: { gte: dayStart, lte: dayEnd } },
    include: {
      shift: { include: { user: true } },
      order: {
        include: {
          orderItems: { include: { menuItem: { include: { category: true } } } },
          table: true,
          waiter: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Get unique completed orders that have payments today
  const orderMap = new Map();
  for (const payment of allPayments) {
    if (payment.order && !orderMap.has(payment.order.id)) {
      orderMap.set(payment.order.id, payment.order);
    }
  }
  const orders = Array.from(orderMap.values()).filter(o => o.status === "COMPLETED");

  const totalSales = allPayments.reduce((s, p) => s + p.amount, 0);
  const orderCount = orders.length;

  // Aggregate payments by method from Payment records
  const byMethod: Record<string, { count: number; total: number }> = {};
  const byShift: Record<string, { shiftType: string; cashier: string; count: number; total: number }> = {};
  const byWaiter: Record<string, { name: string; count: number; total: number }> = {};
  const byCategory: Record<string, { name: string; qty: number; total: number }> = {};
  const byItem: Record<string, { name: string; category: string; qty: number; total: number }> = {};

  // Aggregate by payment method and by shift
  for (const payment of allPayments) {
    const m = payment.method;
    if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
    byMethod[m].count++;
    byMethod[m].total += payment.amount;

    // Aggregate by shift
    if (payment.shift) {
      const sId = payment.shift.id;
      if (!byShift[sId]) {
        byShift[sId] = {
          shiftType: payment.shift.shiftType,
          cashier: payment.shift.user.name,
          count: 0,
          total: 0
        };
      }
      byShift[sId].count++;
      byShift[sId].total += payment.amount;
    }
  }

  for (const order of orders) {
    const wId = order.waiterId;
    if (!byWaiter[wId]) byWaiter[wId] = { name: order.waiter.name, count: 0, total: 0 };
    byWaiter[wId].count++;
    byWaiter[wId].total += order.total;

    for (const item of order.orderItems) {
      const catName = item.menuItem.category.name;
      const catId = item.menuItem.categoryId;
      if (!byCategory[catId]) byCategory[catId] = { name: catName, qty: 0, total: 0 };
      byCategory[catId].qty += item.quantity;
      byCategory[catId].total += item.price * item.quantity;

      const mId = item.menuItemId;
      if (!byItem[mId]) byItem[mId] = { name: item.menuItem.name, category: catName, qty: 0, total: 0 };
      byItem[mId].qty += item.quantity;
      byItem[mId].total += item.price * item.quantity;
    }
  }

  // Get cancelled orders that were SENT to kitchen for the day (not included in sales totals)
  // Only record cancellations if order was actually sent (sentAt !== null)
  const cancelledOrders = await prisma.order.findMany({
    where: {
      status: "CANCELLED",
      sentAt: { not: null }, // Only orders that were sent to kitchen
      cancelledAt: { gte: dayStart, lte: dayEnd },
    },
    include: {
      orderItems: { include: { menuItem: true } },
      table: true,
      waiter: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  const cancelledTotal = cancelledOrders.reduce((s, o) => s + o.total, 0);
  const cancelledCount = cancelledOrders.length;

  return {
    date: dateStr,
    shifts,
    totalSales,
    orderCount,
    byMethod,
    byShift: Object.values(byShift).sort((a, b) => b.total - a.total),
    byWaiter: Object.values(byWaiter).sort((a, b) => b.total - a.total),
    byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    byItem: Object.values(byItem).sort((a, b) => b.qty - a.qty),
    orders,
    cancelledOrders,
    cancelledTotal,
    cancelledCount,
  };
}

export async function getTodayShiftStatus() {
  const session = await getSession();
  if (!session.userId) return { morning: false, evening: false, openShift: null as null | { id: string; shiftType: string } };

  const { start, end } = todayRange();

  // Check ALL shifts (system-wide, shared across users)
  const todayShifts = await prisma.shift.findMany({
    where: { openedAt: { gte: start, lte: end } },
    orderBy: { openedAt: "desc" },
  });

  const morningDone = todayShifts.some((s) => s.shiftType === "MORNING" && s.closedAt !== null);
  const eveningDone = todayShifts.some((s) => s.shiftType === "EVENING" && s.closedAt !== null);
  const open = todayShifts.find((s) => s.closedAt === null) ?? null;

  return {
    morning: morningDone,
    evening: eveningDone,
    openShift: open ? { id: open.id, shiftType: open.shiftType } : null,
  };
}
