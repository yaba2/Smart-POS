"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { InvoiceStatus, Permission, SupplierStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

const canManage = (permissions: string[] = []) =>
  permissions.includes(Permission.MANAGE_EXPENSES) ||
  permissions.includes(Permission.MANAGE_SETTINGS);

// ── Supplier CRUD ────────────────────────────────────────────────────────────

export async function getSuppliers() {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };

  const suppliers = await prisma.supplier.findMany({
    include: {
      invoices: {
        include: { payments: { orderBy: { paidAt: "desc" } } },
        orderBy: { invoiceDate: "desc" },
      },
    },
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

// ── SupplierInvoice CRUD ─────────────────────────────────────────────────────

export async function createInvoice(data: {
  supplierId: string;
  description?: string;
  totalAmount: number;
  invoiceDate: string;
}) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };
  if (!data.supplierId) return { error: "Supplier is required" };
  if (!data.totalAmount || data.totalAmount <= 0) return { error: "Amount must be greater than 0" };

  const invoice = await prisma.supplierInvoice.create({
    data: {
      supplierId: data.supplierId,
      description: data.description?.trim(),
      totalAmount: data.totalAmount,
      balanceOwed: data.totalAmount,
      amountPaid: 0,
      status: InvoiceStatus.UNPAID,
      invoiceDate: new Date(data.invoiceDate),
    },
  });

  revalidatePath("/admin/suppliers");
  return { success: true, invoice };
}

export async function deleteInvoice(id: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };

  await prisma.supplierInvoice.delete({ where: { id } });

  revalidatePath("/admin/suppliers");
  return { success: true };
}

// ── Invoice Payment recording ────────────────────────────────────────────────

export async function recordInvoicePayment(data: {
  invoiceId: string;
  amount: number;
  method: string;
  notes?: string;
  paidAt: string;
}) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };
  if (!data.amount || data.amount <= 0) return { error: "Amount must be greater than 0" };

  const invoice = await prisma.supplierInvoice.findUnique({ where: { id: data.invoiceId } });
  if (!invoice) return { error: "Invoice not found" };
  if (data.amount > invoice.balanceOwed) return { error: `Payment exceeds balance owed (${invoice.balanceOwed})` };

  await prisma.$transaction(async (tx) => {
    await tx.invoicePayment.create({
      data: {
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.method || "CASH",
        notes: data.notes?.trim(),
        paidAt: new Date(data.paidAt),
      },
    });

    const newAmountPaid = invoice.amountPaid + data.amount;
    const newBalance = invoice.totalAmount - newAmountPaid;
    const newStatus: InvoiceStatus =
      newBalance <= 0
        ? InvoiceStatus.PAID
        : newAmountPaid > 0
        ? InvoiceStatus.PARTIAL
        : InvoiceStatus.UNPAID;

    await tx.supplierInvoice.update({
      where: { id: data.invoiceId },
      data: { amountPaid: newAmountPaid, balanceOwed: newBalance, status: newStatus },
    });
  });

  revalidatePath("/admin/suppliers");
  return { success: true };
}

export async function deleteInvoicePayment(id: string, invoiceId: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };

  const payment = await prisma.invoicePayment.findUnique({ where: { id } });
  if (!payment) return { error: "Payment not found" };

  await prisma.$transaction(async (tx) => {
    await tx.invoicePayment.delete({ where: { id } });

    const invoice = await tx.supplierInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return;

    const newAmountPaid = invoice.amountPaid - payment.amount;
    const newBalance = invoice.totalAmount - newAmountPaid;
    const newStatus: InvoiceStatus =
      newBalance >= invoice.totalAmount
        ? InvoiceStatus.UNPAID
        : newAmountPaid > 0
        ? InvoiceStatus.PARTIAL
        : InvoiceStatus.UNPAID;

    await tx.supplierInvoice.update({
      where: { id: invoiceId },
      data: { amountPaid: newAmountPaid, balanceOwed: newBalance, status: newStatus },
    });
  });

  revalidatePath("/admin/suppliers");
  return { success: true };
}
