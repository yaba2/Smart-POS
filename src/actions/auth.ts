"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

// Default permissions per role
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    "CANCEL_ORDER", "MODIFY_SENT_ORDERS", "PROCESS_REFUND", "VIEW_ALL_ORDERS", "OVERRIDE_PRICES",
    "SETTLE_BILL", "APPLY_DISCOUNT", "SPLIT_BILL",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS", "EXPORT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT", "VIEW_SHIFT_HISTORY",
    "MANAGE_USERS", "MANAGE_ROLES",
    "MANAGE_MENU", "MANAGE_CATEGORIES", "MANAGE_MODIFIERS", "UPDATE_INVENTORY",
    "MANAGE_TABLES", "RESERVE_TABLES",
    "MANAGE_SETTINGS", "MANAGE_TAX_RATES", "CONFIGURE_PRINTERS",
    "VIEW_AUDIT_LOG", "BACKUP_DATA"
  ],
  MANAGER: [
    "CANCEL_ORDER", "MODIFY_SENT_ORDERS", "PROCESS_REFUND", "VIEW_ALL_ORDERS",
    "SETTLE_BILL", "APPLY_DISCOUNT", "SPLIT_BILL",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS", "EXPORT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT", "VIEW_SHIFT_HISTORY",
    "MANAGE_MENU", "MANAGE_CATEGORIES", "UPDATE_INVENTORY",
    "MANAGE_TABLES", "RESERVE_TABLES",
    "MANAGE_SETTINGS"
  ],
  SUPERVISOR: [
    "CANCEL_ORDER", "VIEW_ALL_ORDERS",
    "SETTLE_BILL", "APPLY_DISCOUNT",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT",
    "RESERVE_TABLES"
  ],
  CASHIER: [
    "CANCEL_ORDER", "PROCESS_REFUND", "VIEW_ALL_ORDERS",
    "SETTLE_BILL", "APPLY_DISCOUNT", "SPLIT_BILL",
    "VIEW_REPORTS", "VIEW_SHIFT_REPORTS",
    "OPEN_SHIFT", "CLOSE_SHIFT",
    "RESERVE_TABLES"
  ],
  WAITER: ["VIEW_ALL_ORDERS"],
};

export async function loginWithPin(pin: string) {
  const user = await prisma.user.findFirst({
    where: { pin, active: true, role: { in: ["WAITER", "CASHIER", "MANAGER", "SUPERVISOR"] } },
  });

  if (!user) {
    return { error: "Invalid PIN code" };
  }

  const roleDefaults = DEFAULT_PERMISSIONS[user.role] || [];
  const userPerms = user.permissions as string[];
  const permissions = Array.from(new Set([...roleDefaults, ...userPerms]));

  const session = await getSession();
  session.userId = user.id;
  session.name = user.name;
  session.role = user.role as "ADMIN" | "MANAGER" | "SUPERVISOR" | "CASHIER" | "WAITER";
  session.permissions = permissions;
  session.isLoggedIn = true;
  await session.save();

  return { success: true, name: user.name, role: user.role };
}

export async function loginAdmin(username: string, password: string) {
  // Allow ADMIN, MANAGER, and SUPERVISOR to login to backend
  const user = await prisma.user.findFirst({
    where: { username, active: true, role: { in: ["ADMIN", "MANAGER", "SUPERVISOR"] } },
  });

  if (!user || !user.password) {
    return { error: "Invalid credentials" };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { error: "Invalid credentials" };
  }

  const roleDefaults = DEFAULT_PERMISSIONS[user.role] || [];
  const userPerms = user.permissions as string[];
  const permissions = Array.from(new Set([...roleDefaults, ...userPerms]));

  const session = await getSession();
  session.userId = user.id;
  session.name = user.name;
  session.role = user.role as "ADMIN" | "MANAGER" | "SUPERVISOR" | "CASHIER" | "WAITER";
  session.permissions = permissions;
  session.isLoggedIn = true;
  await session.save();

  return { success: true, role: user.role };
}

export async function logout() {
  const session = await getSession();
  const role = session.role;
  session.destroy();
  // ADMIN, MANAGER, SUPERVISOR redirect to admin login; others to POS login
  if (role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR") {
    redirect("/admin/login");
  } else {
    redirect("/pos/login");
  }
}

export async function getSessionData() {
  const session = await getSession();
  if (!session.isLoggedIn) return null;
  return {
    userId: session.userId,
    name: session.name,
    role: session.role,
    permissions: session.permissions || [],
  };
}

export async function hasPermission(permission: string): Promise<boolean> {
  const session = await getSession();
  if (!session.isLoggedIn) return false;
  // ADMIN has all permissions, others check their permissions
  if (session.role === "ADMIN") return true;
  return (session.permissions || []).includes(permission);
}

// Check if user has backend access (ADMIN, MANAGER, or SUPERVISOR)
export async function hasBackendAccess(): Promise<boolean> {
  const session = await getSession();
  if (!session.isLoggedIn) return false;
  return session.role === "ADMIN" || session.role === "MANAGER" || session.role === "SUPERVISOR";
}
