import { requireAdmin } from "@/lib/auth";
import { getCategories, getMenuItems } from "@/actions/menu";
import { getModifierGroups } from "@/actions/modifiers";
import { MenuAdminClient } from "@/components/admin/menu-admin-client";

export default async function AdminMenuPage() {
  await requireAdmin();
  const [categories, items, modifierGroups] = await Promise.all([
    getCategories(),
    getMenuItems(),
    getModifierGroups(),
  ]);
  return <MenuAdminClient categories={categories} items={items} modifierGroups={modifierGroups} />;
}
