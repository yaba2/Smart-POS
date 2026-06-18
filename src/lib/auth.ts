import { getSession } from "./session";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/pos/login");
  }
  return session;
}

// Backend access for ADMIN, MANAGER, and SUPERVISOR roles
export async function requireAdmin() {
  const session = await getSession();
  const allowedRoles = ["ADMIN", "MANAGER", "SUPERVISOR"];
  if (!session.isLoggedIn || !allowedRoles.includes(session.role || "")) {
    redirect("/admin/login");
  }
  return session;
}

// Strict admin only for sensitive operations
export async function requireStrictAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "ADMIN") {
    redirect("/admin/login");
  }
  return session;
}

export async function requireWaiter() {
  const session = await getSession();
  const allowedRoles = ["WAITER", "CASHIER", "MANAGER", "SUPERVISOR", "ADMIN"];
  if (!session.isLoggedIn || !allowedRoles.includes(session.role || "")) {
    redirect("/pos/login");
  }
  return session;
}
