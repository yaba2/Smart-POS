"use client";

import { localDb } from "./local-db";
import type {
  CachedCategory,
  CachedMenuItem,
  CachedModifierGroup,
  CachedModifierItem,
  CachedTable,
  CachedOrder,
  CachedOrderItem,
} from "./local-db";

export interface ModifierItemOption {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface ModifierGroupData {
  id: string;
  name: string;
  type: string;
  required: boolean;
  multiple: boolean;
  items: ModifierItemOption[];
}

export interface MenuItemData {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image: string | null;
  available: boolean;
  modifierGroups?: { modifierGroup: ModifierGroupData }[];
}

export interface CategoryData {
  id: string;
  name: string;
  items: MenuItemData[];
  modifierGroups?: { modifierGroup: ModifierGroupData }[];
}

export interface TableOrderItemData {
  id: string;
  menuItemId: string;
  quantity: number;
  price: number;
  notes: string | null;
  menuItem: { name: string };
}

export interface TableOrderData {
  id: string;
  status: string;
  total: number;
  paidAmount: number;
  orderItems: TableOrderItemData[];
}

export interface TableWithOrdersData {
  id: string;
  name: string;
  floor: string | null;
  status: string;
  orders: TableOrderData[];
}

export async function buildMenuFromCache(): Promise<CategoryData[]> {
  const [
    categories,
    menuItems,
    modifierGroups,
    modifierItems,
    categoryModifierGroups,
    menuItemModifierGroups,
  ] = await Promise.all([
    localDb.categories.toArray(),
    localDb.menuItems.toArray(),
    localDb.modifierGroups.toArray(),
    localDb.modifierItems.toArray(),
    localDb.categoryModifierGroups.toArray(),
    localDb.menuItemModifierGroups.toArray(),
  ]);

  const modifierGroupsById = new Map(modifierGroups.map((g) => [g.id, g]));
  const modifierItemsByGroupId = new Map<string, CachedModifierItem[]>();
  for (const item of modifierItems) {
    if (!modifierItemsByGroupId.has(item.modifierGroupId)) {
      modifierItemsByGroupId.set(item.modifierGroupId, []);
    }
    modifierItemsByGroupId.get(item.modifierGroupId)!.push(item);
  }

  function buildModifierGroup(groupId: string): ModifierGroupData | null {
    const g = modifierGroupsById.get(groupId);
    if (!g) return null;
    return {
      id: g.id,
      name: g.name,
      type: g.type,
      required: g.required,
      multiple: g.multiple,
      items:
        modifierItemsByGroupId
          .get(g.id)
          ?.filter((i) => i.available)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((i) => ({ id: i.id, name: i.name, price: i.price, available: i.available })) || [],
    };
  }

  const itemsByCategoryId = new Map<string, CachedMenuItem[]>();
  for (const item of menuItems) {
    if (!item.available) continue;
    if (!itemsByCategoryId.has(item.categoryId)) {
      itemsByCategoryId.set(item.categoryId, []);
    }
    itemsByCategoryId.get(item.categoryId)!.push(item);
  }

  const menuItemGroupIds = new Map<string, string[]>();
  for (const row of menuItemModifierGroups) {
    if (!menuItemGroupIds.has(row.menuItemId)) menuItemGroupIds.set(row.menuItemId, []);
    menuItemGroupIds.get(row.menuItemId)!.push(row.modifierGroupId);
  }

  const categoryGroupIds = new Map<string, string[]>();
  for (const row of categoryModifierGroups) {
    if (!categoryGroupIds.has(row.categoryId)) categoryGroupIds.set(row.categoryId, []);
    categoryGroupIds.get(row.categoryId)!.push(row.modifierGroupId);
  }

  return categories
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((cat) => {
      const items = (itemsByCategoryId.get(cat.id) || [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => {
          const groupIds = menuItemGroupIds.get(item.id) || categoryGroupIds.get(cat.id) || [];
          const modifierGroups = groupIds
            .map(buildModifierGroup)
            .filter((g): g is ModifierGroupData => g !== null);
          return {
            id: item.id,
            name: item.name,
            price: item.price,
            description: item.description,
            image: item.image,
            available: item.available,
            modifierGroups: modifierGroups.length > 0 ? modifierGroups.map((g) => ({ modifierGroup: g })) : undefined,
          };
        });

      const catGroupIds = categoryGroupIds.get(cat.id) || [];
      const catModifierGroups = catGroupIds
        .map(buildModifierGroup)
        .filter((g): g is ModifierGroupData => g !== null)
        .map((g) => ({ modifierGroup: g }));

      return {
        id: cat.id,
        name: cat.name,
        items,
        modifierGroups: catModifierGroups.length > 0 ? catModifierGroups : undefined,
      };
    });
}

export async function buildTablesFromCache(): Promise<TableWithOrdersData[]> {
  const [tables, orders, orderItems, menuItems] = await Promise.all([
    localDb.posTables.toArray(),
    localDb.orders.toArray(),
    localDb.orderItems.toArray(),
    localDb.menuItems.toArray(),
  ]);

  const menuItemsById = new Map(menuItems.map((m) => [m.id, m]));
  const orderItemsByOrderId = new Map<string, CachedOrderItem[]>();
  for (const oi of orderItems) {
    if (!orderItemsByOrderId.has(oi.orderId)) orderItemsByOrderId.set(oi.orderId, []);
    orderItemsByOrderId.get(oi.orderId)!.push(oi);
  }

  const ordersByTableId = new Map<string, CachedOrder[]>();
  for (const order of orders) {
    if (!ordersByTableId.has(order.tableId)) ordersByTableId.set(order.tableId, []);
    ordersByTableId.get(order.tableId)!.push(order);
  }

  return tables
    .sort((a, b) => {
      if (a.floor && b.floor) return a.floor.localeCompare(b.floor) || a.name.localeCompare(b.name);
      if (!a.floor && b.floor) return 1;
      if (a.floor && !b.floor) return -1;
      return a.name.localeCompare(b.name);
    })
    .map((table) => {
      const tableOrders = (ordersByTableId.get(table.id) || [])
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((order) => {
          const items = (orderItemsByOrderId.get(order.id) || []).map((oi) => {
            const menuItem = menuItemsById.get(oi.menuItemId);
            return {
              id: oi.id,
              menuItemId: oi.menuItemId,
              quantity: oi.quantity,
              price: oi.price,
              notes: oi.notes,
              menuItem: { name: menuItem?.name || "Unknown" },
            };
          });
          return {
            id: order.id,
            status: order.status,
            total: order.total,
            paidAmount: order.paidAmount,
            orderItems: items,
          };
        });

      return {
        id: table.id,
        name: table.name,
        floor: table.floor,
        status: table.status,
        orders: tableOrders,
      };
    });
}
