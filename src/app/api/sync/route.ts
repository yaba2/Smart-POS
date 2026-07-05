import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Types for the sync payload match Cached* types in local-db.ts
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");
    const sinceDate = since ? new Date(since) : new Date(0);

    // Tables that have updatedAt
    const [
      categories,
      menuItems,
      menuItemOptions,
      modifierGroups,
      modifierItems,
      categoryModifierGroups,
      menuItemModifierGroups,
      tables,
      rooms,
      paymentMethods,
      users,
      orders,
      orderItems,
    ] = await Promise.all([
      prisma.category.findMany({
        where: { updatedAt: { gt: sinceDate } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.menuItem.findMany({
        where: { updatedAt: { gt: sinceDate } },
        orderBy: { name: "asc" },
      }),
      prisma.menuItemOption.findMany({
        where: { updatedAt: { gt: sinceDate } },
      }),
      prisma.modifierGroup.findMany({
        where: { updatedAt: { gt: sinceDate } },
        orderBy: { name: "asc" },
      }),
      prisma.modifierItem.findMany({
        where: { updatedAt: { gt: sinceDate } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.categoryModifierGroup.findMany(), // small join table, always fetch
      prisma.menuItemModifierGroup.findMany(), // small join table, always fetch
      prisma.table.findMany({
        where: { updatedAt: { gt: sinceDate } },
        orderBy: [{ floor: "asc" }, { name: "asc" }],
      }),
      prisma.room.findMany({
        where: { updatedAt: { gt: sinceDate } },
        orderBy: [{ floor: "asc" }, { number: "asc" }],
      }),
      prisma.paymentMethodConfig.findMany({
        orderBy: { sortOrder: "asc" },
      }),
      prisma.user.findMany({
        where: { updatedAt: { gt: sinceDate }, role: { in: ["WAITER", "CASHIER", "MANAGER", "SUPERVISOR"] } },
        select: { id: true, name: true, role: true, pin: true, permissions: true, active: true, updatedAt: true },
      }),
      // Active orders are always fetched because the previous filter by updatedAt might miss order items
      prisma.order.findMany({
        where: {
          status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.orderItem.findMany({
        where: { order: { status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] } } },
      }),
    ]);

    const activeOrderIds = new Set(orders.map((o) => o.id));
    const filteredOrderItems = orderItems.filter((oi) => activeOrderIds.has(oi.orderId));

    // Settings has no updatedAt in current schema, so always fetch the first row
    const settings = await prisma.settings.findFirst();

    // Current open shift for this device/user
    const openShift = await prisma.shift.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: "desc" },
    });

    const formatDate = (d: Date | null) => (d ? d.toISOString() : null);

    return NextResponse.json({
      categories: categories.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() })),
      menuItems: menuItems.map((m) => ({ ...m, updatedAt: m.updatedAt.toISOString() })),
      menuItemOptions: menuItemOptions.map((m) => ({
        ...m,
        updatedAt: m.updatedAt.toISOString(),
      })),
      modifierGroups: modifierGroups.map((m) => ({
        ...m,
        updatedAt: m.updatedAt.toISOString(),
      })),
      modifierItems: modifierItems.map((m) => ({
        ...m,
        updatedAt: m.updatedAt.toISOString(),
      })),
      categoryModifierGroups,
      menuItemModifierGroups,
      tables: tables.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString() })),
      rooms: rooms.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })),
      paymentMethods: paymentMethods.map((p) => ({
        ...p,
        updatedAt: p.updatedAt.toISOString(),
      })),
      users: users.map((u) => ({ ...u, pin: u.pin ?? null, permissions: u.permissions as string[], updatedAt: u.updatedAt.toISOString() })),
      orders: orders.map((o) => ({
        id: o.id,
        tableId: o.tableId,
        waiterId: o.waiterId,
        status: o.status,
        total: o.total,
        paidAmount: o.paidAmount,
        sentAt: formatDate(o.sentAt),
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      orderItems: filteredOrderItems.map((oi) => ({
        ...oi,
        updatedAt: oi.updatedAt.toISOString(),
      })),
      settings: settings
        ? {
            id: settings.id,
            currencySymbol: settings.currencySymbol,
            value: settings,
            updatedAt: new Date().toISOString(),
          }
        : null,
      shift: openShift
        ? {
            id: openShift.id,
            userId: openShift.userId,
            shiftType: openShift.shiftType,
            openedAt: openShift.openedAt.toISOString(),
            closedAt: formatDate(openShift.closedAt),
            openingCash: openShift.openingCash,
            closingCash: openShift.closingCash,
            notes: openShift.notes,
          }
        : null,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
