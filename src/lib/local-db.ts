"use client";

import Dexie, { Table } from "dexie";

// Types match the Prisma models used by POS
export interface CachedCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  printer: string | null;
  updatedAt: string;
}

export interface CachedMenuItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image: string | null;
  available: boolean;
  categoryId: string;
  updatedAt: string;
}

export interface CachedMenuItemOption {
  id: string;
  menuItemId: string;
  name: string;
  choices: string[];
  price: number;
  required: boolean;
  multiple: boolean;
  updatedAt: string;
}

export interface CachedModifierGroup {
  id: string;
  name: string;
  type: string;
  required: boolean;
  multiple: boolean;
  updatedAt: string;
}

export interface CachedModifierItem {
  id: string;
  modifierGroupId: string;
  name: string;
  price: number;
  available: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface CachedCategoryModifierGroup {
  categoryId: string;
  modifierGroupId: string;
}

export interface CachedMenuItemModifierGroup {
  menuItemId: string;
  modifierGroupId: string;
}

export interface CachedTable {
  id: string;
  name: string;
  floor: string | null;
  status: string;
  updatedAt: string;
}

export interface CachedRoom {
  id: string;
  number: string;
  floor: string | null;
  type: string;
  basePrice: number;
  dynamicPrice: number | null;
  status: string;
  updatedAt: string;
}

export interface CachedPaymentMethod {
  id: string;
  name: string;
  code: string;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface CachedSettings {
  id: string;
  currencySymbol: string;
  value: any;
  updatedAt: string;
}

export interface CachedUser {
  id: string;
  name: string;
  role: string;
  pin: string | null;
  permissions: string[];
  active: boolean;
  updatedAt: string;
}

export interface CachedOrder {
  id: string;
  tableId: string;
  waiterId: string;
  status: string;
  total: number;
  paidAmount: number;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CachedOrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  price: number;
  notes: string | null;
  options: string | null;
  updatedAt: string;
}

export interface CachedShift {
  id: string;
  userId: string;
  shiftType: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  notes: string | null;
}

export interface SyncState {
  id: string;
  value: string;
}

export interface OutboxItem {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
  retry: number;
  error?: string;
}

class PosDatabase extends Dexie {
  categories!: Table<CachedCategory, string>;
  menuItems!: Table<CachedMenuItem, string>;
  menuItemOptions!: Table<CachedMenuItemOption, string>;
  modifierGroups!: Table<CachedModifierGroup, string>;
  modifierItems!: Table<CachedModifierItem, string>;
  categoryModifierGroups!: Table<CachedCategoryModifierGroup, [string, string]>;
  menuItemModifierGroups!: Table<CachedMenuItemModifierGroup, [string, string]>;
  posTables!: Table<CachedTable, string>;
  rooms!: Table<CachedRoom, string>;
  paymentMethods!: Table<CachedPaymentMethod, string>;
  settings!: Table<CachedSettings, string>;
  users!: Table<CachedUser, string>;
  orders!: Table<CachedOrder, string>;
  orderItems!: Table<CachedOrderItem, string>;
  shifts!: Table<CachedShift, string>;
  syncState!: Table<SyncState, string>;
  outbox!: Table<OutboxItem, string>;

  constructor() {
    super("SmartPosDB");
    this.version(1).stores({
      categories: "id, updatedAt",
      menuItems: "id, categoryId, updatedAt, [categoryId+available]",
      menuItemOptions: "id, menuItemId, updatedAt",
      modifierGroups: "id, updatedAt",
      modifierItems: "id, modifierGroupId, updatedAt",
      categoryModifierGroups: "[categoryId+modifierGroupId]",
      menuItemModifierGroups: "[menuItemId+modifierGroupId]",
      posTables: "id, updatedAt",
      rooms: "id, updatedAt",
      paymentMethods: "id, updatedAt",
      settings: "id, updatedAt",
      users: "id, updatedAt",
      orders: "id, tableId, status, updatedAt",
      orderItems: "id, orderId, updatedAt",
      shifts: "id, userId, closedAt",
      syncState: "id",
      outbox: "id, createdAt",
    });
    // v2: add pin index on users for offline login lookup
    this.version(2).stores({
      users: "id, pin, updatedAt",
    });
  }
}

export const localDb = new PosDatabase();

export async function getLastSync(): Promise<string | null> {
  const row = await localDb.syncState.get("lastSync");
  return row?.value || null;
}

export async function setLastSync(value: string): Promise<void> {
  await localDb.syncState.put({ id: "lastSync", value });
}

export async function getDeviceId(): Promise<string> {
  let row = await localDb.syncState.get("deviceId");
  if (!row?.value) {
    const id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await localDb.syncState.put({ id: "deviceId", value: id });
    return id;
  }
  return row.value;
}

// Clear everything except syncState (useful for logout / hard reset)
export async function clearLocalData(): Promise<void> {
  await localDb.categories.clear();
  await localDb.menuItems.clear();
  await localDb.menuItemOptions.clear();
  await localDb.modifierGroups.clear();
  await localDb.modifierItems.clear();
  await localDb.categoryModifierGroups.clear();
  await localDb.menuItemModifierGroups.clear();
  await localDb.posTables.clear();
  await localDb.rooms.clear();
  await localDb.paymentMethods.clear();
  await localDb.settings.clear();
  await localDb.users.clear();
  await localDb.orders.clear();
  await localDb.orderItems.clear();
  await localDb.shifts.clear();
  await localDb.outbox.clear();
}
