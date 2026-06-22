"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { InventoryUnit, TransactionType, RequisitionStatus } from "@prisma/client";

// ── Items ─────────────────────────────────────────────────────────────────────

export async function getInventoryItems() {
  return prisma.inventoryItem.findMany({
    where: { active: true },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getAllInventoryItems() {
  return prisma.inventoryItem.findMany({
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createInventoryItem(data: {
  name: string;
  sku?: string;
  category: string;
  unit: InventoryUnit;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel?: number;
  reorderPoint: number;
  costPerUnit: number;
  supplierId?: string;
  description?: string;
  location?: string;
}) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return { error: "Not authenticated" };

  if (data.sku) {
    const existing = await prisma.inventoryItem.findUnique({ where: { sku: data.sku } });
    if (existing) return { error: "SKU already exists" };
  }

  const item = await prisma.inventoryItem.create({
    data: {
      name: data.name,
      sku: data.sku || null,
      category: data.category,
      unit: data.unit,
      currentStock: data.currentStock,
      minStockLevel: data.minStockLevel,
      maxStockLevel: data.maxStockLevel ?? null,
      reorderPoint: data.reorderPoint,
      costPerUnit: data.costPerUnit,
      supplierId: data.supplierId || null,
      description: data.description || null,
      location: data.location || null,
    },
  });

  // Record initial stock as a STOCK_IN transaction if currentStock > 0
  if (data.currentStock > 0) {
    await prisma.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: TransactionType.STOCK_IN,
        quantity: data.currentStock,
        quantityBefore: 0,
        quantityAfter: data.currentStock,
        costPerUnit: data.costPerUnit,
        totalCost: data.currentStock * data.costPerUnit,
        notes: "Initial stock",
        createdById: session.userId!,
      },
    });
  }

  revalidatePath("/admin/inventory");
  return { success: true, item };
}

export async function updateInventoryItem(id: string, data: {
  name?: string;
  sku?: string;
  category?: string;
  unit?: InventoryUnit;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  costPerUnit?: number;
  supplierId?: string;
  description?: string;
  location?: string;
  active?: boolean;
}) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return { error: "Not authenticated" };

  if (data.sku) {
    const existing = await prisma.inventoryItem.findFirst({ where: { sku: data.sku, id: { not: id } } });
    if (existing) return { error: "SKU already exists" };
  }

  const item = await prisma.inventoryItem.update({ where: { id }, data });
  revalidatePath("/admin/inventory");
  return { success: true, item };
}

export async function deleteInventoryItem(id: string) {
  await prisma.inventoryItem.update({ where: { id }, data: { active: false } });
  revalidatePath("/admin/inventory");
  return { success: true };
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function recordTransaction(data: {
  itemId: string;
  type: TransactionType;
  quantity: number;
  costPerUnit?: number;
  reference?: string;
  notes?: string;
}) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return { error: "Not authenticated" };

  const item = await prisma.inventoryItem.findUnique({ where: { id: data.itemId } });
  if (!item) return { error: "Item not found" };

  const qty = data.type === "STOCK_OUT" || data.type === "WASTE"
    ? -Math.abs(data.quantity)
    : Math.abs(data.quantity);

  const quantityAfter = item.currentStock + qty;
  if (quantityAfter < 0) return { error: "Insufficient stock" };

  const [tx] = await prisma.$transaction([
    prisma.inventoryTransaction.create({
      data: {
        itemId: data.itemId,
        type: data.type,
        quantity: Math.abs(data.quantity),
        quantityBefore: item.currentStock,
        quantityAfter,
        costPerUnit: data.costPerUnit ?? item.costPerUnit,
        totalCost: Math.abs(data.quantity) * (data.costPerUnit ?? item.costPerUnit),
        reference: data.reference || null,
        notes: data.notes || null,
        createdById: session.userId!,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: data.itemId },
      data: { currentStock: quantityAfter },
    }),
  ]);

  revalidatePath("/admin/inventory");
  return { success: true, transaction: tx };
}

export async function getTransactions(itemId?: string, limit = 50) {
  return prisma.inventoryTransaction.findMany({
    where: itemId ? { itemId } : undefined,
    include: {
      item: { select: { id: true, name: true, unit: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ── Requisitions ──────────────────────────────────────────────────────────────

export async function getRequisitions() {
  return prisma.stockRequisition.findMany({
    include: {
      requester: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
      items: {
        include: { item: { select: { id: true, name: true, unit: true, currentStock: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createRequisition(data: {
  title: string;
  notes?: string;
  items: { itemId: string; quantityRequested: number; notes?: string }[];
}) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return { error: "Not authenticated" };

  if (!data.items.length) return { error: "At least one item is required" };

  const req = await prisma.stockRequisition.create({
    data: {
      title: data.title,
      notes: data.notes || null,
      requestedBy: session.userId!,
      items: {
        create: data.items.map(i => ({
          itemId: i.itemId,
          quantityRequested: i.quantityRequested,
          notes: i.notes || null,
        })),
      },
    },
    include: {
      requester: { select: { id: true, name: true } },
      items: { include: { item: { select: { id: true, name: true, unit: true } } } },
    },
  });

  revalidatePath("/admin/inventory");
  return { success: true, requisition: req };
}

export async function updateRequisitionStatus(
  id: string,
  status: RequisitionStatus,
  fulfilledQuantities?: Record<string, number>
) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return { error: "Not authenticated" };

  const req = await prisma.stockRequisition.findUnique({
    where: { id },
    include: { items: { include: { item: true } } },
  });
  if (!req) return { error: "Requisition not found" };

  const updateData: Record<string, unknown> = {
    status,
    ...(status === "APPROVED" || status === "REJECTED"
      ? { approvedBy: session.userId!, approvedAt: new Date() }
      : {}),
    ...(status === "FULFILLED" ? { fulfilledAt: new Date() } : {}),
  };

  await prisma.stockRequisition.update({ where: { id }, data: updateData });

  // If fulfilled, deduct stock for each item
  if (status === "FULFILLED" && fulfilledQuantities) {
    for (const reqItem of req.items) {
      const fulfilled = fulfilledQuantities[reqItem.id] ?? reqItem.quantityRequested;
      if (fulfilled > 0) {
        await prisma.requisitionItem.update({
          where: { id: reqItem.id },
          data: { quantityFulfilled: fulfilled },
        });
        await recordTransaction({
          itemId: reqItem.itemId,
          type: TransactionType.STOCK_OUT,
          quantity: fulfilled,
          notes: `Fulfilled requisition: ${req.title}`,
          reference: req.id,
        });
      }
    }
  }

  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function deleteRequisition(id: string) {
  const req = await prisma.stockRequisition.findUnique({ where: { id } });
  if (!req) return { error: "Not found" };
  if (req.status !== "PENDING") return { error: "Only pending requisitions can be deleted" };
  await prisma.stockRequisition.delete({ where: { id } });
  revalidatePath("/admin/inventory");
  return { success: true };
}

// ── Dashboard KPIs ────────────────────────────────────────────────────────────

export async function getInventoryStats() {
  const items = await prisma.inventoryItem.findMany({ where: { active: true } });

  const totalItems = items.length;
  const totalValue = items.reduce((s, i) => s + i.currentStock * i.costPerUnit, 0);
  const lowStockItems = items.filter(i => i.currentStock <= i.minStockLevel && i.minStockLevel > 0);
  const outOfStockItems = items.filter(i => i.currentStock === 0);
  const pendingRequisitions = await prisma.stockRequisition.count({ where: { status: "PENDING" } });

  return { totalItems, totalValue, lowStockCount: lowStockItems.length, outOfStockCount: outOfStockItems.length, pendingRequisitions };
}
