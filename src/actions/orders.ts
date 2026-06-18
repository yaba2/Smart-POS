"use server";

import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getAnyOpenShift } from "./shifts";

export async function getOrderByTable(tableId: string) {
  return prisma.order.findFirst({
    where: {
      tableId,
      status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] },
    },
    include: {
      orderItems: {
        include: { menuItem: true },
        orderBy: { createdAt: "asc" },
      },
      table: true,
      waiter: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createOrder(tableId: string, waiterId: string) {
  // Check for existing open order
  const existing = await prisma.order.findFirst({
    where: { tableId, status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] } },
  });
  if (existing) return { success: true, order: existing };

  const order = await prisma.order.create({
    data: {
      tableId,
      waiterId,
      status: OrderStatus.OPEN,
      total: 0,
    },
  });

  revalidatePath("/pos/tables");
  return { success: true, order };
}

export async function addItemToOrder(
  orderId: string,
  menuItemId: string,
  quantity: number,
  notes?: string,
  options?: string,
  priceOverride?: number
) {
  const [menuItem, order] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id: menuItemId } }),
    prisma.order.findUnique({ where: { id: orderId } }),
  ]);
  if (!menuItem) return { error: "Item not found" };
  if (!order) return { error: "Order not found" };

  const finalPrice = priceOverride ?? menuItem.price;

  // Only merge with an existing row when the order is still OPEN (not yet sent to kitchen),
  // and when there are no options/notes (different options = different row).
  const canMerge = order.status === "OPEN" && !options && !notes;
  const existing = canMerge
    ? await prisma.orderItem.findFirst({ where: { orderId, menuItemId, notes: null, options: null } })
    : null;

  let orderItem;
  if (existing) {
    orderItem = await prisma.orderItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  } else {
    orderItem = await prisma.orderItem.create({
      data: {
        orderId,
        menuItemId,
        quantity,
        price: finalPrice,
        notes,
        options,
      },
    });
  }

  await recalculateOrderTotal(orderId);
  return { success: true, orderItem };
}

export async function updateOrderItemQuantity(orderItemId: string, quantity: number) {
  if (quantity <= 0) {
    await prisma.orderItem.delete({ where: { id: orderItemId } });
  } else {
    await prisma.orderItem.update({
      where: { id: orderItemId },
      data: { quantity },
    });
  }

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
  });
  if (orderItem) await recalculateOrderTotal(orderItem.orderId);
  return { success: true };
}

export async function removeOrderItem(orderItemId: string) {
  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
  if (!item) return { error: "Item not found" };

  await prisma.orderItem.delete({ where: { id: orderItemId } });
  await recalculateOrderTotal(item.orderId);
  return { success: true };
}

export async function updateOrderItemNotes(orderItemId: string, notes: string) {
  await prisma.orderItem.update({
    where: { id: orderItemId },
    data: { notes },
  });
  return { success: true };
}

export async function sendOrder(orderId: string) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.SENT, sentAt: new Date() },
    include: { table: true },
  });
  await prisma.table.update({
    where: { id: order.tableId },
    data: { status: TableStatus.OCCUPIED },
  });
  revalidatePath("/pos/tables");
  return { success: true, order };
}

export async function printBill(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "Order not found" };

  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.SENT },
  });

  await prisma.table.update({
    where: { id: order.tableId },
    data: { status: TableStatus.WAITING_PAYMENT },
  });

  revalidatePath("/pos/tables");
  return { success: true };
}

export async function completePayment(orderId: string, paymentMethod: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true },
  });
  if (!order) return { error: "Order not found" };

  // Get current active shift
  const shift = await getAnyOpenShift();
  if (!shift) return { error: "No open shift found" };

  // Calculate remaining amount to pay (in case of partial payments)
  const remainingAmount = order.total - order.paidAmount;

  // Record the payment transaction with shiftId
  await prisma.payment.create({
    data: {
      orderId,
      shiftId: shift.id,
      amount: remainingAmount,
      method: paymentMethod,
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.COMPLETED, paymentMethod, paidAt: new Date(), paidAmount: order.total },
  });

  const otherOrders = await prisma.order.count({
    where: {
      tableId: order.tableId,
      status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] },
      id: { not: orderId },
    },
  });

  if (otherOrders === 0) {
    await prisma.table.update({
      where: { id: order.tableId },
      data: { status: TableStatus.AVAILABLE },
    });
  }

  revalidatePath("/pos/tables");
  return { success: true };
}

export async function cancelOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderItems: true },
  });
  if (!order) return { error: "Order not found" };

  // Check if order was sent to kitchen (has sentAt timestamp)
  const wasSentToKitchen = order.sentAt !== null;

  // Calculate total from order items (in case order total is 0 for unsent orders)
  const orderTotal = order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      // Store total in case it wasn't calculated yet
      total: orderTotal,
    },
  });

  const otherOrders = await prisma.order.count({
    where: {
      tableId: order.tableId,
      status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] },
      id: { not: orderId },
    },
  });

  if (otherOrders === 0) {
    await prisma.table.update({
      where: { id: order.tableId },
      data: { status: TableStatus.AVAILABLE },
    });
  }

  revalidatePath("/pos/tables");
  return {
    success: true,
    wasSentToKitchen,
    message: wasSentToKitchen
      ? "Order cancelled after being sent to kitchen"
      : "Order cancelled before being sent to kitchen",
  };
}

export async function getFullOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: { menuItem: { include: { category: true } } },
        orderBy: { createdAt: "asc" },
      },
      table: true,
      waiter: true,
    },
  });
}

export async function getRecentOrders(limit = 20) {
  return prisma.order.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      table: true,
      waiter: true,
      orderItems: { include: { menuItem: true } },
    },
  });
}

async function recalculateOrderTotal(orderId: string) {
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  await prisma.order.update({ where: { id: orderId }, data: { total } });
}

// Merge Orders: Move all items from sourceOrderId into targetOrderId, then delete source
export async function mergeOrders(targetOrderId: string, sourceOrderId: string) {
  if (targetOrderId === sourceOrderId) return { error: "Cannot merge order with itself" };

  const [target, source] = await Promise.all([
    prisma.order.findUnique({ where: { id: targetOrderId }, include: { orderItems: true } }),
    prisma.order.findUnique({ where: { id: sourceOrderId }, include: { orderItems: true, table: true } }),
  ]);

  if (!target || !source) return { error: "Order not found" };

  // Move all items from source to target
  for (const item of source.orderItems) {
    // Check if same menuItem+notes already exists in target
    const existing = target.orderItems.find(
      (t) => t.menuItemId === item.menuItemId && (t.notes || null) === (item.notes || null)
    );
    if (existing) {
      await prisma.orderItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + item.quantity },
      });
      await prisma.orderItem.delete({ where: { id: item.id } });
    } else {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { orderId: targetOrderId },
      });
    }
  }

  // Delete the source order
  await prisma.order.delete({ where: { id: sourceOrderId } });
  await recalculateOrderTotal(targetOrderId);

  // Keep table status as-is (it will reflect the remaining order status)
  revalidatePath("/pos/tables");
  return { success: true };
}

// Split Bill: Create a new order with selected items, keep remaining items on original order
export async function splitBill(
  originalOrderId: string,
  itemIds: string[],
  waiterId: string,
  action: "print" | "settle",
  paymentMethod?: string
) {
  const originalOrder = await prisma.order.findUnique({
    where: { id: originalOrderId },
    include: { orderItems: true, table: true },
  });
  if (!originalOrder) return { error: "Order not found" };

  // Validate all items exist on this order
  const selectedItems = originalOrder.orderItems.filter((item) => itemIds.includes(item.id));
  if (selectedItems.length === 0) return { error: "No items selected" };

  const remainingItems = originalOrder.orderItems.filter((item) => !itemIds.includes(item.id));
  const selectedTotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const remainingTotal = remainingItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const allSelected = remainingItems.length === 0;

  // Create new order for split items
  const splitOrder = await prisma.order.create({
    data: {
      tableId: originalOrder.tableId,
      waiterId,
      status: action === "settle" ? OrderStatus.COMPLETED : OrderStatus.SENT,
      total: selectedTotal,
      paidAmount: action === "settle" ? selectedTotal : 0,
      paymentMethod: action === "settle" ? (paymentMethod ?? "CASH") : null,
      paidAt: action === "settle" ? new Date() : null,
    },
  });

  // Record payment if settling
  if (action === "settle" && selectedTotal > 0) {
    // Get current active shift
    const currentShift = await getAnyOpenShift();
    await prisma.payment.create({
      data: {
        orderId: splitOrder.id,
        shiftId: currentShift?.id ?? null,
        amount: selectedTotal,
        method: paymentMethod ?? "CASH",
      },
    });
  }

  // Move selected items to new order
  for (const item of selectedItems) {
    await prisma.orderItem.create({
      data: {
        orderId: splitOrder.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes,
      },
    });
    await prisma.orderItem.delete({ where: { id: item.id } });
  }

  if (allSelected) {
    // All items selected — complete/handle the original order too
    await prisma.order.update({
      where: { id: originalOrderId },
      data: {
        status: OrderStatus.COMPLETED,
        paidAt: action === "settle" ? new Date() : null,
        total: 0,
      },
    });
  } else {
    // Update original order with remaining total
    await prisma.order.update({
      where: { id: originalOrderId },
      data: { total: remainingTotal },
    });
  }

  // Update table status: WAITING_PAYMENT if settle, keep OCCUPIED if just print
  await prisma.table.update({
    where: { id: originalOrder.tableId },
    data: { status: action === "settle" && allSelected ? TableStatus.AVAILABLE : TableStatus.WAITING_PAYMENT },
  });

  revalidatePath("/pos/tables");
  return { success: true, splitOrder };
}

// Partial Payment: Record partial payment on an order
export async function recordPartialPayment(
  orderId: string,
  paymentMethod: string,
  amount: number
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true },
  });
  if (!order) return { error: "Order not found" };

  // Get current active shift
  const shift = await getAnyOpenShift();
  if (!shift) return { error: "No open shift found" };

  const newPaidAmount = order.paidAmount + amount;
  const isFullyPaid = newPaidAmount >= order.total;

  // Record the payment transaction with shiftId
  await prisma.payment.create({
    data: {
      orderId,
      shiftId: shift.id,
      amount,
      method: paymentMethod,
    },
  });

  if (isFullyPaid) {
    // Fully paid - complete the order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.COMPLETED,
        paymentMethod,
        paidAt: new Date(),
        paidAmount: order.total,
      },
    });

    // Check if other orders exist on this table
    const otherOrders = await prisma.order.count({
      where: {
        tableId: order.tableId,
        status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] },
        id: { not: orderId },
      },
    });

    if (otherOrders === 0) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: TableStatus.AVAILABLE },
      });
    }
  } else {
    // Partial payment - keep order as WAITING_PAYMENT
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.WAITING_PAYMENT,
        paidAmount: newPaidAmount,
      },
    });
  }

  revalidatePath("/pos/tables");
  return {
    success: true,
    fullyPaid: isFullyPaid,
    remaining: Math.max(0, order.total - newPaidAmount),
    paidAmount: isFullyPaid ? order.total : newPaidAmount,
  };
}

// Close Table: Make table available and navigate back (public action - no permission needed)
export async function closeTable(tableId: string) {
  await prisma.table.update({
    where: { id: tableId },
    data: { status: TableStatus.AVAILABLE },
  });
  revalidatePath("/pos/tables");
  return { success: true };
}
