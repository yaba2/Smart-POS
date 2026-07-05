"use server";

import { prisma } from "@/lib/prisma";
import { CreditStatus, OrderStatus, TableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getAnyOpenShift } from "./shifts";

async function createCustomerCreditForOrder(customerId: string, orderId: string, amount: number): Promise<{ error: string } | { success: true }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { credits: true },
  });
  if (!customer) return { error: "Customer not found" };
  if (!customer.active) return { error: "Customer is inactive" };

  const currentOwed = customer.credits.reduce(
    (sum, c) => sum + (c.originalAmount - c.paidAmount),
    0
  );
  if (customer.creditLimit > 0 && currentOwed + amount > customer.creditLimit) {
    return { error: "This would exceed the customer's credit limit" };
  }

  await prisma.customerCredit.create({
    data: {
      customerId,
      orderId,
      originalAmount: amount,
      paidAmount: 0,
      status: CreditStatus.PENDING,
    },
  });
  return { success: true };
}

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
  try {
    const existing = await prisma.order.findFirst({
      where: { tableId, status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] } },
    });
    if (existing) return { success: true, order: existing };

    const order = await prisma.order.create({
      data: { tableId, waiterId, status: OrderStatus.OPEN, total: 0 },
    });
    revalidatePath("/pos/tables");
    return { success: true, order };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

export async function addItemToOrder(
  orderId: string,
  menuItemId: string,
  quantity: number,
  notes?: string,
  options?: string,
  priceOverride?: number
) {
  try {
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
        data: { orderId, menuItemId, quantity, price: finalPrice, notes, options },
      });
    }

    await recalculateOrderTotal(orderId);
    return { success: true, orderItem };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

export async function updateOrderItemQuantity(orderItemId: string, quantity: number) {
  try {
    if (quantity <= 0) {
      await prisma.orderItem.delete({ where: { id: orderItemId } });
    } else {
      await prisma.orderItem.update({ where: { id: orderItemId }, data: { quantity } });
    }
    const orderItem = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
    if (orderItem) await recalculateOrderTotal(orderItem.orderId);
    return { success: true };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

export async function removeOrderItem(orderItemId: string) {
  try {
    const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
    if (!item) return { error: "Item not found" };
    await prisma.orderItem.delete({ where: { id: orderItemId } });
    await recalculateOrderTotal(item.orderId);
    return { success: true };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

export async function updateOrderItemNotes(orderItemId: string, notes: string) {
  try {
    await prisma.orderItem.update({ where: { id: orderItemId }, data: { notes } });
    return { success: true };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

export async function sendOrder(orderId: string) {
  try {
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
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

export async function printBill(orderId: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return { error: "Order not found" };
    await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.SENT } });
    await prisma.table.update({ where: { id: order.tableId }, data: { status: TableStatus.WAITING_PAYMENT } });
    revalidatePath("/pos/tables");
    return { success: true };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

export async function completePayment(orderId: string, paymentMethod: string, customerName?: string, customerId?: string): Promise<{ error: string } | { success: true }> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { table: true } });
    if (!order) return { error: "Order not found" };

    const shift = await getAnyOpenShift();
    if (!shift) return { error: "No open shift found" };

    const remainingAmount = order.total - order.paidAmount;

    if (paymentMethod === "CUSTOMER_CREDIT") {
      if (!customerId) return { error: "Customer is required for credit payment" };
      const creditResult = await createCustomerCreditForOrder(customerId, orderId, remainingAmount);
      if ("error" in creditResult) return creditResult;
    }

    await prisma.payment.create({
      data: { orderId, shiftId: shift.id, amount: remainingAmount, method: paymentMethod },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.COMPLETED, paymentMethod, paidAt: new Date(), paidAmount: order.total, customerName: customerName || null },
    });

    const otherOrders = await prisma.order.count({
      where: { tableId: order.tableId, status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] }, id: { not: orderId } },
    });
    if (otherOrders === 0) {
      await prisma.table.update({ where: { id: order.tableId }, data: { status: TableStatus.AVAILABLE } });
    }
    revalidatePath("/pos/tables");
    return { success: true };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

export async function cancelOrder(orderId: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { orderItems: true } });
    if (!order) return { error: "Order not found" };

    const wasSentToKitchen = order.sentAt !== null;
    const orderTotal = order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), total: orderTotal },
    });

    const otherOrders = await prisma.order.count({
      where: { tableId: order.tableId, status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] }, id: { not: orderId } },
    });
    if (otherOrders === 0) {
      await prisma.table.update({ where: { id: order.tableId }, data: { status: TableStatus.AVAILABLE } });
    }
    revalidatePath("/pos/tables");
    return {
      success: true,
      wasSentToKitchen,
      message: wasSentToKitchen ? "Order cancelled after being sent to kitchen" : "Order cancelled before being sent to kitchen",
    };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
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
  try {
    const [target, source] = await Promise.all([
      prisma.order.findUnique({ where: { id: targetOrderId }, include: { orderItems: true } }),
      prisma.order.findUnique({ where: { id: sourceOrderId }, include: { orderItems: true, table: true } }),
    ]);
    if (!target || !source) return { error: "Order not found" };

    for (const item of source.orderItems) {
      const existing = target.orderItems.find(
        (t) => t.menuItemId === item.menuItemId && (t.notes || null) === (item.notes || null)
      );
      if (existing) {
        await prisma.orderItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + item.quantity } });
        await prisma.orderItem.delete({ where: { id: item.id } });
      } else {
        await prisma.orderItem.update({ where: { id: item.id }, data: { orderId: targetOrderId } });
      }
    }
    await prisma.order.delete({ where: { id: sourceOrderId } });
    await recalculateOrderTotal(targetOrderId);
    revalidatePath("/pos/tables");
    return { success: true };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

// Split Bill: Create a new order with selected items, keep remaining items on original order
export async function splitBill(
  originalOrderId: string,
  itemIds: string[],
  waiterId: string,
  action: "print" | "settle",
  paymentMethod?: string,
  customerName?: string,
  customerId?: string
): Promise<{ error: string } | { success: true; splitOrder: any }> {
  try {
    const originalOrder = await prisma.order.findUnique({
      where: { id: originalOrderId },
      include: { orderItems: true, table: true },
    });
    if (!originalOrder) return { error: "Order not found" };

    const selectedItems = originalOrder.orderItems.filter((item) => itemIds.includes(item.id));
    if (selectedItems.length === 0) return { error: "No items selected" };

    const remainingItems = originalOrder.orderItems.filter((item) => !itemIds.includes(item.id));
    const selectedTotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const remainingTotal = remainingItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const allSelected = remainingItems.length === 0;

    const splitOrder = await prisma.order.create({
      data: {
        tableId: originalOrder.tableId,
        waiterId,
        status: action === "settle" ? OrderStatus.COMPLETED : OrderStatus.SENT,
        total: selectedTotal,
        paidAmount: action === "settle" ? selectedTotal : 0,
        paymentMethod: action === "settle" ? (paymentMethod ?? "CASH") : null,
        paidAt: action === "settle" ? new Date() : null,
        customerName: action === "settle" ? (customerName || null) : null,
      },
    });

    if (action === "settle" && selectedTotal > 0) {
      if (paymentMethod === "CUSTOMER_CREDIT") {
        if (!customerId) return { error: "Customer is required for credit payment" };
        const creditResult = await createCustomerCreditForOrder(customerId, splitOrder.id, selectedTotal);
        if ("error" in creditResult) return creditResult;
      }
      const currentShift = await getAnyOpenShift();
      await prisma.payment.create({
        data: { orderId: splitOrder.id, shiftId: currentShift?.id ?? null, amount: selectedTotal, method: paymentMethod ?? "CASH" },
      });
    }

    for (const item of selectedItems) {
      await prisma.orderItem.create({
        data: { orderId: splitOrder.id, menuItemId: item.menuItemId, quantity: item.quantity, price: item.price, notes: item.notes },
      });
      await prisma.orderItem.delete({ where: { id: item.id } });
    }

    if (allSelected) {
      await prisma.order.update({
        where: { id: originalOrderId },
        data: { status: OrderStatus.COMPLETED, paidAt: action === "settle" ? new Date() : null, total: 0 },
      });
    } else {
      await prisma.order.update({ where: { id: originalOrderId }, data: { total: remainingTotal } });
    }

    await prisma.table.update({
      where: { id: originalOrder.tableId },
      data: { status: action === "settle" && allSelected ? TableStatus.AVAILABLE : TableStatus.WAITING_PAYMENT },
    });

    revalidatePath("/pos/tables");
    return { success: true, splitOrder };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

// Partial Payment: Record partial payment on an order
export async function recordPartialPayment(
  orderId: string,
  paymentMethod: string,
  amount: number,
  customerName?: string,
  customerId?: string
): Promise<{ error: string } | { success: true; fullyPaid: boolean; remaining: number; paidAmount: number }> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { table: true } });
    if (!order) return { error: "Order not found" };

    const shift = await getAnyOpenShift();
    if (!shift) return { error: "No open shift found" };

    const newPaidAmount = order.paidAmount + amount;
    const isFullyPaid = newPaidAmount >= order.total;

    if (paymentMethod === "CUSTOMER_CREDIT") {
      if (!customerId) return { error: "Customer is required for credit payment" };
      const creditResult = await createCustomerCreditForOrder(customerId, orderId, amount);
      if ("error" in creditResult) return creditResult;
    }

    await prisma.payment.create({
      data: { orderId, shiftId: shift.id, amount, method: paymentMethod },
    });

    if (isFullyPaid) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED, paymentMethod, paidAt: new Date(), paidAmount: order.total, customerName: customerName || null },
      });
      const otherOrders = await prisma.order.count({
        where: { tableId: order.tableId, status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] }, id: { not: orderId } },
      });
      if (otherOrders === 0) {
        await prisma.table.update({ where: { id: order.tableId }, data: { status: TableStatus.AVAILABLE } });
      }
    } else {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.WAITING_PAYMENT, paidAmount: newPaidAmount },
      });
    }

    revalidatePath("/pos/tables");
    return {
      success: true,
      fullyPaid: isFullyPaid,
      remaining: Math.max(0, order.total - newPaidAmount),
      paidAmount: isFullyPaid ? order.total : newPaidAmount,
    };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}

// Close Table: Make table available and navigate back (public action - no permission needed)
export async function closeTable(tableId: string) {
  try {
    await prisma.table.update({ where: { id: tableId }, data: { status: TableStatus.AVAILABLE } });
    revalidatePath("/pos/tables");
    return { success: true };
  } catch {
    return { error: "Cannot reach server. You are offline." };
  }
}
