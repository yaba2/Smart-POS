"use server";

import { prisma } from "@/lib/prisma";
import { TableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getTables() {
  return prisma.table.findMany({
    orderBy: [{ floor: "asc" }, { name: "asc" }],
    include: {
      orders: {
        where: { status: { in: ["OPEN", "SENT", "WAITING_PAYMENT"] } },
        orderBy: { createdAt: "desc" },
        include: { orderItems: { include: { menuItem: true } } },
      },
    },
  });
}

export async function getFloors(): Promise<string[]> {
  const rows = await prisma.table.findMany({
    where: { floor: { not: null } },
    select: { floor: true },
    distinct: ["floor"],
    orderBy: { floor: "asc" },
  });
  return rows.map((r) => r.floor as string);
}

export async function createTable(name: string, floor?: string) {
  const table = await prisma.table.create({
    data: { name, floor: floor || null, status: TableStatus.AVAILABLE },
  });
  revalidatePath("/admin/tables");
  revalidatePath("/pos/tables");
  return { success: true, table };
}

export async function updateTable(id: string, data: { name?: string; floor?: string | null; status?: TableStatus }) {
  const table = await prisma.table.update({
    where: { id },
    data,
  });
  revalidatePath("/admin/tables");
  revalidatePath("/pos/tables");
  return { success: true, table };
}

export async function deleteTable(id: string) {
  await prisma.table.delete({ where: { id } });
  revalidatePath("/admin/tables");
  revalidatePath("/pos/tables");
  return { success: true };
}

export async function renameFloor(oldName: string, newName: string) {
  await prisma.table.updateMany({
    where: { floor: oldName },
    data: { floor: newName },
  });
  revalidatePath("/admin/tables");
  revalidatePath("/pos/tables");
  return { success: true };
}

export async function deleteFloor(name: string) {
  await prisma.table.updateMany({
    where: { floor: name },
    data: { floor: null },
  });
  revalidatePath("/admin/tables");
  revalidatePath("/pos/tables");
  return { success: true };
}
