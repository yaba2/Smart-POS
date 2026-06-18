import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

// GET /api/orders/kds?station=kitchen|bar|all
// Returns SENT orders (active kitchen tickets), optionally filtered by category printer
export async function GET(req: NextRequest) {
  const station = req.nextUrl.searchParams.get("station")?.toUpperCase() ?? "ALL";

  try {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.SENT, OrderStatus.WAITING_PAYMENT] },
      },
      include: {
        table: true,
        waiter: { select: { id: true, name: true } },
        orderItems: {
          include: {
            menuItem: {
              include: { category: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { sentAt: "asc" }, // oldest ticket first
    });

    // Filter order items by station unless "ALL"
    const filtered = orders
      .map((order) => {
        const items =
          station === "ALL"
            ? order.orderItems
            : order.orderItems.filter(
                (oi) =>
                  oi.menuItem.category.printer?.toUpperCase() === station
              );
        return { ...order, orderItems: items };
      })
      // Drop orders that have zero relevant items for this station
      .filter((o) => o.orderItems.length > 0);

    return NextResponse.json(filtered);
  } catch (err) {
    console.error("[KDS GET]", err);
    return NextResponse.json({ error: "Failed to fetch KDS orders" }, { status: 500 });
  }
}

// PATCH /api/orders/kds
// Body: { orderId: string, action: "bump" | "recall" }
//   bump   → SENT → WAITING_PAYMENT  (order is ready, waiting cashier)
//   recall → WAITING_PAYMENT → SENT  (undo a bump)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action } = body as { orderId: string; action: "bump" | "recall" };

    if (!orderId || !action) {
      return NextResponse.json({ error: "orderId and action are required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    let newStatus: OrderStatus;
    if (action === "bump") {
      if (order.status !== OrderStatus.SENT) {
        return NextResponse.json({ error: "Order is not in SENT status" }, { status: 409 });
      }
      newStatus = OrderStatus.WAITING_PAYMENT;
    } else if (action === "recall") {
      if (order.status !== OrderStatus.WAITING_PAYMENT) {
        return NextResponse.json({ error: "Order is not in WAITING_PAYMENT status" }, { status: 409 });
      }
      newStatus = OrderStatus.SENT;
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (err) {
    console.error("[KDS PATCH]", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
