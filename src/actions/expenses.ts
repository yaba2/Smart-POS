"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ExpenseCategory, Permission } from "@prisma/client";
import { revalidatePath } from "next/cache";

const canManage = (permissions: string[] = []) =>
  permissions.includes(Permission.MANAGE_EXPENSES) || permissions.includes(Permission.MANAGE_SETTINGS);

export async function getExpenses(from?: string, to?: string, category?: ExpenseCategory | "ALL") {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };

  const where: any = {};
  if (from && to) {
    where.date = { gte: new Date(from), lte: new Date(`${to}T23:59:59.999Z`) };
  } else if (from) {
    where.date = { gte: new Date(from), lte: new Date(`${from}T23:59:59.999Z`) };
  }
  if (category && category !== "ALL") {
    where.category = category;
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { createdBy: true },
    orderBy: { date: "desc" },
  });

  return { expenses };
}

export async function createExpense(data: {
  amount: number;
  category: ExpenseCategory;
  description: string;
  paymentMethod: string;
  date: string;
}) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };
  if (!data.amount || data.amount <= 0) return { error: "Amount must be greater than 0" };
  if (!data.category) return { error: "Category is required" };
  if (!data.date) return { error: "Date is required" };

  const expense = await prisma.expense.create({
    data: {
      amount: data.amount,
      category: data.category,
      description: data.description?.trim() || "",
      paymentMethod: data.paymentMethod || "CASH",
      date: new Date(data.date),
      createdById: session.userId,
    },
  });

  revalidatePath("/admin/expenses");
  return { success: true, expense };
}

export async function updateExpense(
  id: string,
  data: {
    amount: number;
    category: ExpenseCategory;
    description: string;
    paymentMethod: string;
    date: string;
  }
) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };
  if (!data.amount || data.amount <= 0) return { error: "Amount must be greater than 0" };
  if (!data.category) return { error: "Category is required" };
  if (!data.date) return { error: "Date is required" };

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      amount: data.amount,
      category: data.category,
      description: data.description?.trim() || "",
      paymentMethod: data.paymentMethod || "CASH",
      date: new Date(data.date),
    },
  });

  revalidatePath("/admin/expenses");
  return { success: true, expense };
}

export async function deleteExpense(id: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };

  await prisma.expense.delete({ where: { id } });

  revalidatePath("/admin/expenses");
  return { success: true };
}

export async function getExpenseSummary(from?: string, to?: string) {
  const session = await getSession();
  if (!session.userId) return { total: 0, count: 0, byCategory: [] };

  const where: any = {};
  if (from && to) {
    where.date = { gte: new Date(from), lte: new Date(`${to}T23:59:59.999Z`) };
  } else if (from) {
    where.date = { gte: new Date(from), lte: new Date(`${from}T23:59:59.999Z`) };
  }

  const [total, byCategory] = await Promise.all([
    prisma.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
    prisma.expense.groupBy({ by: ["category"], where, _sum: { amount: true }, _count: true }),
  ]);

  return { total: total._sum.amount ?? 0, count: total._count, byCategory };
}
