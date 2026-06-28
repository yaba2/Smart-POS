"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { CreditStatus, Permission } from "@prisma/client";
import { revalidatePath } from "next/cache";

const canManage = (permissions: string[] = []) =>
  permissions.includes(Permission.MANAGE_CUSTOMER_CREDITS) ||
  permissions.includes(Permission.MANAGE_SETTINGS);

export async function getCustomerCredits() {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };

  const credits = await prisma.customerCredit.findMany({
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      order: { select: { id: true, table: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { credits };
}

export async function getCustomerCreditSummary(customerId: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      credits: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) return { error: "Customer not found" };

  const totalOwed = customer.credits.reduce(
    (sum, c) => sum + (c.originalAmount - c.paidAmount),
    0
  );
  const totalCreditLimit = customer.creditLimit;

  return { customer, totalOwed, totalCreditLimit };
}

export async function createCustomerCredit(data: {
  customerId: string;
  orderId: string;
  amount: number;
}) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };

  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    include: { credits: true },
  });
  if (!customer) return { error: "Customer not found" };
  if (!customer.active) return { error: "Customer is inactive" };

  const currentOwed = customer.credits.reduce(
    (sum, c) => sum + (c.originalAmount - c.paidAmount),
    0
  );
  if (customer.creditLimit > 0 && currentOwed + data.amount > customer.creditLimit) {
    return { error: "This would exceed the customer's credit limit" };
  }

  const credit = await prisma.customerCredit.create({
    data: {
      customerId: data.customerId,
      orderId: data.orderId,
      originalAmount: data.amount,
      paidAmount: 0,
      status: CreditStatus.PENDING,
    },
  });

  revalidatePath("/admin/customer-credits");
  revalidatePath("/admin/customers");
  return { success: true, credit };
}

export async function recordCustomerCreditPayment(id: string, amount: number) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };
  if (amount <= 0) return { error: "Amount must be greater than 0" };

  const credit = await prisma.customerCredit.findUnique({ where: { id } });
  if (!credit) return { error: "Credit not found" };

  const remaining = credit.originalAmount - credit.paidAmount;
  if (amount > remaining) return { error: `Amount cannot exceed remaining balance ${remaining.toFixed(2)}` };

  const newPaid = credit.paidAmount + amount;
  let status: CreditStatus = CreditStatus.PARTIALLY_PAID;
  if (newPaid >= credit.originalAmount) status = CreditStatus.PAID;

  const updated = await prisma.customerCredit.update({
    where: { id },
    data: {
      paidAmount: newPaid,
      status,
    },
  });

  revalidatePath("/admin/customer-credits");
  revalidatePath("/admin/customers");
  return { success: true, credit: updated };
}

export async function markCustomerCreditPaid(id: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };

  const credit = await prisma.customerCredit.findUnique({ where: { id } });
  if (!credit) return { error: "Credit not found" };

  const updated = await prisma.customerCredit.update({
    where: { id },
    data: {
      paidAmount: credit.originalAmount,
      status: CreditStatus.PAID,
    },
  });

  revalidatePath("/admin/customer-credits");
  revalidatePath("/admin/customers");
  return { success: true, credit: updated };
}
