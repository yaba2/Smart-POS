"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ── Modifier Groups ────────────────────────────────────────────────────────────

export async function getModifierGroups() {
  return prisma.modifierGroup.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      categories: { include: { category: { select: { id: true, name: true } } } },
      menuItems: { include: { menuItem: { select: { id: true, name: true } } } },
    },
  });
}

export async function createModifierGroup(data: {
  name: string;
  type: "ACCOMPANIMENT" | "EXTRA";
  required?: boolean;
  multiple?: boolean;
}) {
  try {
    const group = await prisma.modifierGroup.create({
      data: {
        name: data.name,
        type: data.type,
        required: data.required ?? false,
        multiple: data.multiple ?? false,
      },
    });
    revalidatePath("/admin/menu");
    return { success: true, group };
  } catch {
    return { error: "Failed to create modifier group" };
  }
}

export async function updateModifierGroup(
  id: string,
  data: { name?: string; type?: string; required?: boolean; multiple?: boolean }
) {
  try {
    const group = await prisma.modifierGroup.update({ where: { id }, data });
    revalidatePath("/admin/menu");
    return { success: true, group };
  } catch {
    return { error: "Failed to update modifier group" };
  }
}

export async function deleteModifierGroup(id: string) {
  try {
    await prisma.modifierGroup.delete({ where: { id } });
    revalidatePath("/admin/menu");
    return { success: true };
  } catch {
    return { error: "Failed to delete modifier group" };
  }
}

// ── Modifier Items ─────────────────────────────────────────────────────────────

export async function createModifierItem(data: {
  modifierGroupId: string;
  name: string;
  price?: number;
  sortOrder?: number;
}) {
  try {
    const item = await prisma.modifierItem.create({
      data: {
        modifierGroupId: data.modifierGroupId,
        name: data.name,
        price: data.price ?? 0,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    revalidatePath("/admin/menu");
    return { success: true, item };
  } catch {
    return { error: "Failed to create modifier item" };
  }
}

export async function updateModifierItem(
  id: string,
  data: { name?: string; price?: number; available?: boolean; sortOrder?: number }
) {
  try {
    const item = await prisma.modifierItem.update({ where: { id }, data });
    revalidatePath("/admin/menu");
    return { success: true, item };
  } catch {
    return { error: "Failed to update modifier item" };
  }
}

export async function deleteModifierItem(id: string) {
  try {
    await prisma.modifierItem.delete({ where: { id } });
    revalidatePath("/admin/menu");
    return { success: true };
  } catch {
    return { error: "Failed to delete modifier item" };
  }
}

// ── Assignments ────────────────────────────────────────────────────────────────

export async function assignModifierGroupToCategory(categoryId: string, modifierGroupId: string) {
  try {
    await prisma.categoryModifierGroup.upsert({
      where: { categoryId_modifierGroupId: { categoryId, modifierGroupId } },
      create: { categoryId, modifierGroupId },
      update: {},
    });
    revalidatePath("/admin/menu");
    return { success: true };
  } catch {
    return { error: "Failed to assign modifier group" };
  }
}

export async function removeModifierGroupFromCategory(categoryId: string, modifierGroupId: string) {
  try {
    await prisma.categoryModifierGroup.delete({
      where: { categoryId_modifierGroupId: { categoryId, modifierGroupId } },
    });
    revalidatePath("/admin/menu");
    return { success: true };
  } catch {
    return { error: "Failed to remove modifier group" };
  }
}

export async function assignModifierGroupToMenuItem(menuItemId: string, modifierGroupId: string) {
  try {
    await prisma.menuItemModifierGroup.upsert({
      where: { menuItemId_modifierGroupId: { menuItemId, modifierGroupId } },
      create: { menuItemId, modifierGroupId },
      update: {},
    });
    revalidatePath("/admin/menu");
    return { success: true };
  } catch {
    return { error: "Failed to assign modifier group" };
  }
}

export async function removeModifierGroupFromMenuItem(menuItemId: string, modifierGroupId: string) {
  try {
    await prisma.menuItemModifierGroup.delete({
      where: { menuItemId_modifierGroupId: { menuItemId, modifierGroupId } },
    });
    revalidatePath("/admin/menu");
    return { success: true };
  } catch {
    return { error: "Failed to remove modifier group" };
  }
}

// ── POS: get modifiers applicable to a menu item ───────────────────────────────
// Returns modifier groups assigned directly to the item OR to its category.
export async function getModifiersForMenuItem(menuItemId: string) {
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    select: { categoryId: true },
  });
  if (!menuItem) return [];

  const [itemGroups, categoryGroups] = await Promise.all([
    prisma.menuItemModifierGroup.findMany({
      where: { menuItemId },
      include: {
        modifierGroup: { include: { items: { where: { available: true }, orderBy: { sortOrder: "asc" } } } },
      },
    }),
    prisma.categoryModifierGroup.findMany({
      where: { categoryId: menuItem.categoryId },
      include: {
        modifierGroup: { include: { items: { where: { available: true }, orderBy: { sortOrder: "asc" } } } },
      },
    }),
  ]);

  // Merge, deduplicate by modifierGroupId (item-level takes precedence)
  const seen = new Set<string>();
  const result = [];

  for (const r of [...itemGroups, ...categoryGroups]) {
    const g = r.modifierGroup;
    if (!seen.has(g.id)) {
      seen.add(g.id);
      result.push(g);
    }
  }

  return result;
}
