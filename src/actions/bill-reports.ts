"use server";

import { prisma } from "@/lib/prisma";

export async function getBillReports(from: string, to?: string, utcOffset = 0) {
  const endDateStr = to ?? from;
  const start = new Date(`${from}T00:00:00.000Z`);
  start.setUTCMinutes(start.getUTCMinutes() - utcOffset);
  const end = new Date(`${endDateStr}T23:59:59.999Z`);
  end.setUTCMinutes(end.getUTCMinutes() - utcOffset);

  // Use payments.createdAt to find bills paid in this range, matching daily report logic
  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: {
      order: {
        include: {
          table: true,
          waiter: true,
          payments: { orderBy: { createdAt: "asc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const uniqueOrders = new Map();
  for (const payment of payments) {
    const order = payment.order;
    if (!order || order.status !== "COMPLETED") continue;
    if (!uniqueOrders.has(order.id)) {
      uniqueOrders.set(order.id, order);
    }
  }

  return Array.from(uniqueOrders.values()).map((order) => ({
    id: order.id,
    orderNumber: order.id.slice(-6).toUpperCase(),
    tableName: order.table.name,
    waiterName: order.waiter.name,
    customerName: order.customerName || "—",
    total: order.total,
    paidAmount: order.paidAmount,
    paymentMethod: order.paymentMethod || "—",
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    payments: order.payments.map((p: { id: string; amount: number; method: string; createdAt: Date }) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      createdAt: p.createdAt,
    })),
  }));
}
