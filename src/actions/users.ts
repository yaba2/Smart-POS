"use server";

import { prisma } from "@/lib/prisma";
import { Role, Permission } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

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

  const user = await prisma.user.create({
    data: {
      name: data.name,
      role: data.role,
      pin: data.pin,
      username: data.username || data.name.toLowerCase().replace(/\s+/g, ""),
      password: hashedPassword,
      active: true,
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
