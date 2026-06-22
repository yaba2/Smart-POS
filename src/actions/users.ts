"use server";

import { prisma } from "@/lib/prisma";
import { Role, Permission } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [
    "CANCEL_ORDER", "MODIFY_SENT_ORDERS", "PROCESS_REFUND", "VIEW_ALL_ORDERS", "OVERRIDE_PRICES",
    "SETTLE_BILL", "APPLY_DISCOUNT", "SPLIT_BILL",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS", "EXPORT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT", "VIEW_SHIFT_HISTORY",
    "MANAGE_USERS", "MANAGE_ROLES",
    "MANAGE_MENU", "MANAGE_CATEGORIES", "MANAGE_MODIFIERS", "UPDATE_INVENTORY",
    "MANAGE_TABLES", "RESERVE_TABLES",
    "MANAGE_SETTINGS", "MANAGE_TAX_RATES", "CONFIGURE_PRINTERS",
    "VIEW_AUDIT_LOG", "BACKUP_DATA",
  ] as Permission[],
  MANAGER: [
    "CANCEL_ORDER", "MODIFY_SENT_ORDERS", "PROCESS_REFUND", "VIEW_ALL_ORDERS",
    "SETTLE_BILL", "APPLY_DISCOUNT", "SPLIT_BILL",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS", "EXPORT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT", "VIEW_SHIFT_HISTORY",
    "MANAGE_MENU", "MANAGE_CATEGORIES", "UPDATE_INVENTORY",
    "MANAGE_TABLES", "RESERVE_TABLES",
    "MANAGE_SETTINGS",
  ] as Permission[],
  SUPERVISOR: [
    "CANCEL_ORDER", "VIEW_ALL_ORDERS",
    "SETTLE_BILL", "APPLY_DISCOUNT",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT",
    "RESERVE_TABLES",
  ] as Permission[],
  CASHIER: [
    "CANCEL_ORDER", "PROCESS_REFUND", "VIEW_ALL_ORDERS",
    "SETTLE_BILL", "APPLY_DISCOUNT", "SPLIT_BILL",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT",
    "RESERVE_TABLES",
  ] as Permission[],
  WAITER: ["VIEW_ALL_ORDERS"] as Permission[],
};

export async function getUsers() {
  return prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      username: true,
      active: true,
      createdAt: true,
      pin: true,
      permissions: true,
    },
  });
}

export async function createUser(data: {
  name: string;
  role: Role;
  pin?: string;
  username?: string;
  password?: string;
}) {
  const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : undefined;

  if (data.username) {
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) return { error: "Username already exists" };
  } else if (data.name) {
    // Auto-generate username from name if not provided
    data.username = data.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    // Check if auto-generated username exists
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) {
      data.username = `${data.username}_${Date.now().toString().slice(-4)}`;
    }
  }

  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[data.role] || [];

  const user = await prisma.user.create({
    data: {
      name: data.name,
      role: data.role,
      pin: data.pin,
      username: data.username || data.name.toLowerCase().replace(/\s+/g, ""),
      password: hashedPassword,
      active: true,
      permissions: roleDefaults,
    },
    select: {
      id: true,
      name: true,
      role: true,
      username: true,
      active: true,
      createdAt: true,
    },
  });

  revalidatePath("/admin/users");
  return { success: true, user };
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    pin?: string;
    username?: string;
    password?: string;
    active?: boolean;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.pin !== undefined) updateData.pin = data.pin;
  if (data.username !== undefined) updateData.username = data.username;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.password) updateData.password = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      role: true,
      username: true,
      active: true,
    },
  });

  revalidatePath("/admin/users");
  return { success: true, user };
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUserPermissions(id: string, permissions: string[]) {
  // Convert string array to Permission enum values
  const validPermissions = permissions.filter((p): p is Permission =>
    Object.values(Permission).includes(p as Permission)
  );

  await prisma.user.update({
    where: { id },
    data: { permissions: validPermissions },
  });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserActive(id: string, active: boolean) {
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function backfillUserPermissions() {
  const users = await prisma.user.findMany({
    where: { permissions: { isEmpty: true } },
    select: { id: true, role: true },
  });

  for (const user of users) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    if (defaults.length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { permissions: defaults },
      });
    }
  }

  revalidatePath("/admin/users");
  return { success: true, count: users.length };
}
