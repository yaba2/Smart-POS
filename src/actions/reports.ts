"use server";

import { prisma } from "@/lib/prisma";

export async function getSalesReport(from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: {
      status: "COMPLETED",
      paidAt: { gte: from, lte: to },
    },
    include: {
      orderItems: { include: { menuItem: { include: { category: true } } } },
      table: true,
      waiter: true,
    },
    orderBy: { paidAt: "desc" },
  });

  const totalSales = orders.reduce((s, o) => s + o.total, 0);
  const orderCount = orders.length;

  const byPaymentMethod: Record<string, { count: number; total: number }> = {};
  const byWaiter: Record<string, { name: string; count: number; total: number }> = {};
  const byCategory: Record<string, { name: string; qty: number; total: number }> = {};
  const byItem: Record<string, { name: string; qty: number; total: number }> = {};

  for (const order of orders) {
    const m = order.paymentMethod || "UNKNOWN";
    if (!byPaymentMethod[m]) byPaymentMethod[m] = { count: 0, total: 0 };
    byPaymentMethod[m].count++;
    byPaymentMethod[m].total += order.total;

    const wId = order.waiterId;
    if (!byWaiter[wId]) byWaiter[wId] = { name: order.waiter.name, count: 0, total: 0 };
    byWaiter[wId].count++;
    byWaiter[wId].total += order.total;

    for (const item of order.orderItems) {
      const catId = item.menuItem.categoryId;
      const catName = item.menuItem.category.name;
      if (!byCategory[catId]) byCategory[catId] = { name: catName, qty: 0, total: 0 };
      byCategory[catId].qty += item.quantity;
      byCategory[catId].total += item.price * item.quantity;

      const mId = item.menuItemId;
      if (!byItem[mId]) byItem[mId] = { name: item.menuItem.name, qty: 0, total: 0 };
      byItem[mId].qty += item.quantity;
      byItem[mId].total += item.price * item.quantity;
    }
  }

  const topItems = Object.values(byItem)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  return {
    orders,
    totalSales,
    orderCount,
    byPaymentMethod,
    byWaiter: Object.values(byWaiter).sort((a, b) => b.total - a.total),
    byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    topItems,
  };
}

export async function getAllShifts() {
  return prisma.shift.findMany({
    orderBy: { openedAt: "desc" },
    take: 50,
    include: { user: true },
  });
}
