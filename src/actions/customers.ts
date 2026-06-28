"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Permission } from "@prisma/client";
import { revalidatePath } from "next/cache";

const canManage = (permissions: string[] = []) =>
  permissions.includes(Permission.MANAGE_CUSTOMERS) ||
  permissions.includes(Permission.MANAGE_SETTINGS);

export async function getCustomers() {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };

  const customers = await prisma.customer.findMany({
    include: {
      credits: {
        select: {
          id: true,
          originalAmount: true,
          paidAmount: true,
          status: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return { customers };
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  creditLimit?: number;
}) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };
  if (!data.name.trim()) return { error: "Customer name is required" };

  const customer = await prisma.customer.create({
    data: {
      name: data.name.trim(),
      phone: data.phone?.trim(),
      address: data.address?.trim(),
      email: data.email?.trim(),
      creditLimit: data.creditLimit ?? 0,
    },
  });

  revalidatePath("/admin/customers");
  revalidatePath("/admin/customer-credits");
  return { success: true, customer };
}

export async function updateCustomer(
  id: string,
  data: {
    name: string;
    phone?: string;
    address?: string;
    email?: string;
    creditLimit?: number;
    active?: boolean;
  }
) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };
  if (!data.name.trim()) return { error: "Customer name is required" };

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: data.name.trim(),
      phone: data.phone?.trim(),
      address: data.address?.trim(),
      email: data.email?.trim(),
      creditLimit: data.creditLimit ?? 0,
      active: data.active ?? true,
    },
  });

  revalidatePath("/admin/customers");
  revalidatePath("/admin/customer-credits");
  return { success: true, customer };
}

export async function deleteCustomer(id: string) {
  const session = await getSession();
  if (!session.userId) return { error: "Not authenticated" };
  if (!canManage(session.permissions)) return { error: "Permission denied" };

  await prisma.customer.delete({ where: { id } });

  revalidatePath("/admin/customers");
  revalidatePath("/admin/customer-credits");
  return { success: true };
}
