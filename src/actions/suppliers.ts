"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Permission, SupplierStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

const canManage = (permissions: string[] = []) =>
  permissions.includes(Permission.MANAGE_EXPENSES) ||
  permissions.includes(Permission.MANAGE_SETTINGS);

export async function getSuppliers() {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };

  const suppliers = await prisma.supplier.findMany({
    include: { payments: { orderBy: { date: "desc" } } },
    orderBy: { name: "asc" },
  });

  return { suppliers };
}

export async function createSupplier(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  totalOwed?: number;
}) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };
  if (!data.name.trim()) return { error: "Supplier name is required" };

  const supplier = await prisma.supplier.create({
    data: {
      name: data.name.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim(),
      address: data.address?.trim(),
      notes: data.notes?.trim(),
      totalOwed: data.totalOwed || 0,
    },
  });

  revalidatePath("/admin/suppliers");
  return { success: true, supplier };
}

export async function updateSupplier(
  id: string,
  data: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    totalOwed?: number;
    status?: SupplierStatus;
  }
) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };
  if (!data.name.trim()) return { error: "Supplier name is required" };

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: data.name.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim(),
      address: data.address?.trim(),
      notes: data.notes?.trim(),
      totalOwed: data.totalOwed || 0,
      status: data.status,
    },
  });

  revalidatePath("/admin/suppliers");
  return { success: true, supplier };
}

export async function deleteSupplier(id: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };

  await prisma.supplier.delete({ where: { id } });

  revalidatePath("/admin/suppliers");
  return { success: true };
}

export async function recordSupplierPayment(data: {
  supplierId: string;
  amount: number;
  date: string;
  method?: string;
  notes?: string;
}) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };
  if (!data.amount || data.amount <= 0) return { error: "Amount must be greater than 0" };
  if (!data.supplierId) return { error: "Supplier is required" };

  const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
  if (!supplier) return { error: "Supplier not found" };

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.supplierPayment.create({
      data: {
        supplierId: data.supplierId,
        amount: data.amount,
        date: new Date(data.date),
        method: data.method || "CASH",
        notes: data.notes?.trim(),
      },
    });

    await tx.supplier.update({
      where: { id: data.supplierId },
      data: { totalPaid: { increment: data.amount } },
    });

    return p;
  });

  revalidatePath("/admin/suppliers");
  return { success: true, payment };
}

export async function getSupplierPayments(supplierId: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };

  const payments = await prisma.supplierPayment.findMany({
    where: { supplierId },
    orderBy: { date: "desc" },
  });

  return { payments };
}

export async function deleteSupplierPayment(id: string, supplierId: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };

  const payment = await prisma.supplierPayment.findUnique({ where: { id } });
  if (!payment) return { error: "Payment not found" };

  await prisma.$transaction(async (tx) => {
    await tx.supplierPayment.delete({ where: { id } });
    await tx.supplier.update({
      where: { id: supplierId },
      data: { totalPaid: { decrement: payment.amount } },
    });
  });

  revalidatePath("/admin/suppliers");
  return { success: true };
}
