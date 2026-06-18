"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getPaymentMethods() {
  return prisma.paymentMethodConfig.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export async function createPaymentMethod(data: {
  name: string;
  code: string;
  icon?: string;
  color?: string;
}) {
  try {
    // Get max sort order
    const maxOrder = await prisma.paymentMethodConfig.aggregate({
      _max: { sortOrder: true },
    });

    const method = await prisma.paymentMethodConfig.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        icon: data.icon,
        color: data.color,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1,
      },
    });

    revalidatePath("/admin/payment-methods");
    revalidatePath("/pos");
    return { success: true, method };
  } catch (error) {
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return { error: "Payment method code already exists" };
    }
    return { error: "Failed to create payment method" };
  }
}

export async function updatePaymentMethod(
  id: string,
  data: {
    name: string;
    icon?: string;
    color?: string;
    active?: boolean;
    sortOrder?: number;
  }
) {
  try {
    const method = await prisma.paymentMethodConfig.update({
      where: { id },
      data: {
        name: data.name,
        icon: data.icon,
        color: data.color,
        active: data.active,
        sortOrder: data.sortOrder,
      },
    });

    revalidatePath("/admin/payment-methods");
    revalidatePath("/pos");
    return { success: true, method };
  } catch (error) {
    return { error: "Failed to update payment method" };
  }
}

export async function deletePaymentMethod(id: string) {
  try {
    await prisma.paymentMethodConfig.delete({ where: { id } });
    revalidatePath("/admin/payment-methods");
    revalidatePath("/pos");
    return { success: true };
  } catch (error) {
    return { error: "Failed to delete payment method" };
  }
}

export async function reorderPaymentMethods(orderedIds: string[]) {
  try {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.paymentMethodConfig.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    revalidatePath("/admin/payment-methods");
    revalidatePath("/pos");
    return { success: true };
  } catch (error) {
    return { error: "Failed to reorder payment methods" };
  }
}
