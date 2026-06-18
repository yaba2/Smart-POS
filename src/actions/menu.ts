"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { items: true } } },
  });
}

export async function getMenuItems(categoryId?: string) {
  return prisma.menuItem.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: { name: "asc" },
    include: { category: true },
  });
}

export async function getAvailableMenu() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      modifierGroups: {
        include: {
          modifierGroup: {
            include: { items: { where: { available: true }, orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      items: {
        where: { available: true },
        orderBy: { name: "asc" },
        include: {
          modifierGroups: {
            include: {
              modifierGroup: {
                include: { items: { where: { available: true }, orderBy: { sortOrder: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
}

export async function createCategory(data: { name: string; description?: string; sortOrder?: number; printer?: string }) {
  const category = await prisma.category.create({
    data: {
      name: data.name,
      description: data.description,
      sortOrder: data.sortOrder,
      printer: data.printer?.toUpperCase(),
    },
  });
  revalidatePath("/admin/menu");
  return { success: true, category };
}

export async function updateCategory(id: string, data: { name?: string; description?: string; sortOrder?: number; printer?: string }) {
  const category = await prisma.category.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      sortOrder: data.sortOrder,
      printer: data.printer?.toUpperCase(),
    },
  });
  revalidatePath("/admin/menu");
  return { success: true, category };
}

export async function deleteCategory(id: string) {
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function createMenuItem(data: {
  name: string;
  price: number;
  description?: string;
  image?: string;
  available?: boolean;
  categoryId: string;
}) {
  const item = await prisma.menuItem.create({ data });
  revalidatePath("/admin/menu");
  return { success: true, item };
}

export async function updateMenuItem(
  id: string,
  data: {
    name?: string;
    price?: number;
    description?: string;
    image?: string;
    available?: boolean;
    categoryId?: string;
  }
) {
  const item = await prisma.menuItem.update({ where: { id }, data });
  revalidatePath("/admin/menu");
  return { success: true, item };
}

export async function deleteMenuItem(id: string) {
  await prisma.menuItem.delete({ where: { id } });
  revalidatePath("/admin/menu");
  return { success: true };
}

export async function toggleMenuItemAvailability(id: string, available: boolean) {
  const item = await prisma.menuItem.update({
    where: { id },
    data: { available },
  });
  revalidatePath("/admin/menu");
  return { success: true, item };
}

// Menu Item Options (toppings/add-ons)
export async function getMenuItemOptions(menuItemId: string) {
  return prisma.menuItemOption.findMany({
    where: { menuItemId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createMenuItemOption(data: {
  menuItemId: string;
  name: string;
  choices: string[];
  price?: number;
  required?: boolean;
  multiple?: boolean;
}) {
  try {
    const option = await prisma.menuItemOption.create({
      data: {
        menuItemId: data.menuItemId,
        name: data.name,
        choices: data.choices,
        price: data.price || 0,
        required: data.required || false,
        multiple: data.multiple || false,
      },
    });
    revalidatePath("/admin/menu");
    return { success: true, option };
  } catch (error) {
    return { error: "Failed to create option" };
  }
}

export async function updateMenuItemOption(
  id: string,
  data: {
    name?: string;
    choices?: string[];
    price?: number;
    required?: boolean;
    multiple?: boolean;
  }
) {
  try {
    const option = await prisma.menuItemOption.update({
      where: { id },
      data: {
        name: data.name,
        choices: data.choices,
        price: data.price,
        required: data.required,
        multiple: data.multiple,
      },
    });
    revalidatePath("/admin/menu");
    return { success: true, option };
  } catch (error) {
    return { error: "Failed to update option" };
  }
}

export async function deleteMenuItemOption(id: string) {
  try {
    await prisma.menuItemOption.delete({ where: { id } });
    revalidatePath("/admin/menu");
    return { success: true };
  } catch (error) {
    return { error: "Failed to delete option" };
  }
}
