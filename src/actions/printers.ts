"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getPrinters() {
  return prisma.printer.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createPrinter(data: {
  name: string;
  destination: string;
  connectionType?: string;
  ipAddress?: string;
  port?: number;
  isDefault?: boolean;
  active?: boolean;
}) {
  try {
    if (data.isDefault) {
      await prisma.printer.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const printer = await prisma.printer.create({
      data: {
        name: data.name,
        destination: data.destination.toUpperCase(),
        connectionType: (data.connectionType || "NETWORK").toUpperCase(),
        ipAddress: data.ipAddress || null,
        port: data.port || 9100,
        isDefault: data.isDefault || false,
        active: data.active !== false,
      },
    });

    revalidatePath("/admin/printers");
    revalidatePath("/admin/categories");
    return { success: true, printer };
  } catch (error) {
    return { error: "Failed to create printer" };
  }
}

export async function updatePrinter(
  id: string,
  data: {
    name: string;
    destination: string;
    connectionType?: string;
    ipAddress?: string;
    port?: number;
    isDefault?: boolean;
    active?: boolean;
  }
) {
  try {
    if (data.isDefault) {
      await prisma.printer.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const printer = await prisma.printer.update({
      where: { id },
      data: {
        name: data.name,
        destination: data.destination.toUpperCase(),
        connectionType: (data.connectionType || "NETWORK").toUpperCase(),
        ipAddress: data.ipAddress || null,
        port: data.port || 9100,
        isDefault: data.isDefault,
        active: data.active,
      },
    });

    revalidatePath("/admin/printers");
    revalidatePath("/admin/categories");
    return { success: true, printer };
  } catch (error) {
    return { error: "Failed to update printer" };
  }
}

export async function deletePrinter(id: string) {
  try {
    await prisma.printer.delete({ where: { id } });
    revalidatePath("/admin/printers");
    revalidatePath("/admin/categories");
    return { success: true };
  } catch (error) {
    return { error: "Failed to delete printer" };
  }
}
