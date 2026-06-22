"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Permission } from "@prisma/client";

const canView = (permissions: string[] = []) =>
  permissions.includes(Permission.VIEW_REPORTS) ||
  permissions.includes(Permission.MANAGE_SETTINGS);

export async function getBalanceSheet(from?: string, to?: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canView(session.permissions)) return { error: "Permission denied" };

  const dateFilter =
    from && to
      ? { gte: new Date(from), lte: new Date(`${to}T23:59:59.999Z`) }
      : undefined;

  const orderDateFilter = dateFilter ? { paidAt: dateFilter } : {};
  const expenseDateFilter = dateFilter ? { date: dateFilter } : {};
  const invoiceDateFilter = dateFilter ? { invoiceDate: dateFilter } : {};

  // ── A. Cash-on-Hand ─────────────────────────────────────────────────────────
  // = Cash Sales - Cash Expenses - Cash Invoice Payments

  const [cashSalesAgg, cashExpensesAgg, cashInvoicePaymentsAgg] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "COMPLETED", paymentMethod: "CASH", ...orderDateFilter },
      _sum: { total: true },
    }),
    prisma.expense.aggregate({
      where: { paymentMethod: "CASH", ...expenseDateFilter },
      _sum: { amount: true },
    }),
    prisma.invoicePayment.aggregate({
      where: {
        method: "CASH",
        ...(dateFilter ? { paidAt: dateFilter } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const cashSales = cashSalesAgg._sum.total ?? 0;
  const cashExpenses = cashExpensesAgg._sum.amount ?? 0;
  const cashInvoicePayments = cashInvoicePaymentsAgg._sum.amount ?? 0;
  const cashOnHand = cashSales - cashExpenses - cashInvoicePayments;

  // ── B. Accounts Payable (Total Liabilities) ──────────────────────────────────
  // = Sum of balanceOwed on all unpaid/partial invoices in date range

  const accountsPayableAgg = await prisma.supplierInvoice.aggregate({
    where: {
      status: { not: "PAID" },
      ...invoiceDateFilter,
    },
    _sum: { balanceOwed: true },
  });

  const accountsPayable = accountsPayableAgg._sum.balanceOwed ?? 0;

  // ── C. Net Profit ────────────────────────────────────────────────────────────
  // = Total Sales Revenue - Total Expenses - Total Supplier Invoice Payments

  const [totalSalesAgg, totalExpensesAgg, totalInvoicePaymentsAgg] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "COMPLETED", ...orderDateFilter },
      _sum: { total: true },
    }),
    prisma.expense.aggregate({
      where: { ...expenseDateFilter },
      _sum: { amount: true },
    }),
    prisma.invoicePayment.aggregate({
      where: {
        ...(dateFilter ? { paidAt: dateFilter } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const totalSales = totalSalesAgg._sum.total ?? 0;
  const totalExpenses = totalExpensesAgg._sum.amount ?? 0;
  const totalInvoicePayments = totalInvoicePaymentsAgg._sum.amount ?? 0;
  const netProfit = totalSales - totalExpenses - totalInvoicePayments;

  // ── Breakdown detail for UI ───────────────────────────────────────────────

  const [expensesByCategory, salesByMethod, topSupplierOwed] = await Promise.all([
    prisma.expense.groupBy({
      by: ["category"],
      where: { ...expenseDateFilter },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: { status: "COMPLETED", ...orderDateFilter },
      _sum: { total: true },
      _count: true,
    }),
    prisma.supplierInvoice.groupBy({
      by: ["supplierId"],
      where: { status: { not: "PAID" } },
      _sum: { balanceOwed: true },
      orderBy: { _sum: { balanceOwed: "desc" } },
      take: 5,
    }),
  ]);

  const supplierIds = topSupplierOwed.map((s) => s.supplierId);
  const supplierNames = await prisma.supplier.findMany({
    where: { id: { in: supplierIds } },
    select: { id: true, name: true },
  });

  const topOwed = topSupplierOwed.map((s) => ({
    supplierId: s.supplierId,
    name: supplierNames.find((n) => n.id === s.supplierId)?.name ?? "Unknown",
    balanceOwed: s._sum.balanceOwed ?? 0,
  }));

  return {
    kpis: {
      cashOnHand,
      accountsPayable,
      netProfit,
    },
    detail: {
      totalSales,
      cashSales,
      totalExpenses,
      cashExpenses,
      totalInvoicePayments,
      cashInvoicePayments,
      expensesByCategory,
      salesByMethod,
      topOwed,
    },
  };
}
