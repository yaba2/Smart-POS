"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSettings() {
  const settings = await prisma.settings.findFirst();
  if (!settings) {
    return prisma.settings.create({
      data: {
        restaurantName: "Smart POS Restaurant",
        currency: "USD",
        currencySymbol: "$",
        tax: 8,
      },
    });
  }
  return settings;
}

export async function updateSettings(data: {
  restaurantName?: string;
  logo?: string;
  currency?: string;
  currencySymbol?: string;
  tax?: number;
  receiptHeader?: string;
  receiptFooter?: string;
  address?: string;
  phone?: string;
  printServerIp?: string;
}) {
  const existing = await prisma.settings.findFirst();
  let settings;
  if (existing) {
    settings = await prisma.settings.update({ where: { id: existing.id }, data });
  } else {
    settings = await prisma.settings.create({ data });
  }
  revalidatePath("/admin/settings");
  return { success: true, settings };
}

export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayOrders, totalSales, activeTables, popularItems, recentOrders] = await Promise.all([
    prisma.order.count({
      where: {
        createdAt: { gte: today },
        status: { in: ["COMPLETED", "SENT"] },
      },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: today },
        status: "COMPLETED",
      },
      _sum: { total: true },
    }),
    prisma.table.count({
      where: { status: { in: ["OCCUPIED", "WAITING_PAYMENT"] } },
    }),
    prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        order: { createdAt: { gte: today }, status: { not: "CANCELLED" } },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { table: true, waiter: true },
    }),
  ]);

  const popularItemIds = popularItems.map((i) => i.menuItemId);
  const popularItemDetails = await prisma.menuItem.findMany({
    where: { id: { in: popularItemIds } },
  });

  const popularWithDetails = popularItems.map((p) => ({
    ...p,
    menuItem: popularItemDetails.find((i) => i.id === p.menuItemId),
  }));

  return {
    todayOrders,
    todaySales: totalSales._sum.total || 0,
    activeTables,
    popularItems: popularWithDetails,
    recentOrders,
  };
}
