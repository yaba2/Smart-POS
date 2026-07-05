"use client";

import { useEffect, useRef, useCallback } from "react";
import { localDb, setLastSync, getLastSync } from "@/lib/local-db";
import type {
  CachedCategory,
  CachedMenuItem,
  CachedMenuItemOption,
  CachedModifierGroup,
  CachedModifierItem,
  CachedCategoryModifierGroup,
  CachedMenuItemModifierGroup,
  CachedTable,
  CachedRoom,
  CachedPaymentMethod,
  CachedSettings,
  CachedUser,
  CachedOrder,
  CachedOrderItem,
  CachedShift,
} from "@/lib/local-db";

export interface SyncResult {
  ok: boolean;
  error?: string;
  hasNewData?: boolean;
}

export async function syncPos(): Promise<SyncResult> {
  if (typeof window === "undefined") return { ok: true };
  if (!navigator.onLine) return { ok: true, error: "Offline" };

  try {
    const since = await getLastSync();
    const url = since ? `/api/sync?since=${encodeURIComponent(since)}` : "/api/sync";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Sync failed: ${res.status} ${text}` };
    }

    const data = await res.json();
    if (data.error) return { ok: false, error: data.error };

    await localDb.transaction(
      "rw",
      [
        localDb.categories,
        localDb.menuItems,
        localDb.menuItemOptions,
        localDb.modifierGroups,
        localDb.modifierItems,
        localDb.categoryModifierGroups,
        localDb.menuItemModifierGroups,
        localDb.posTables,
        localDb.rooms,
        localDb.paymentMethods,
        localDb.settings,
        localDb.users,
        localDb.orders,
        localDb.orderItems,
        localDb.shifts,
      ],
      async () => {
        if (data.categories?.length) await localDb.categories.bulkPut(data.categories as CachedCategory[]);
        if (data.menuItems?.length) await localDb.menuItems.bulkPut(data.menuItems as CachedMenuItem[]);
        if (data.menuItemOptions?.length) await localDb.menuItemOptions.bulkPut(data.menuItemOptions as CachedMenuItemOption[]);
        if (data.modifierGroups?.length) await localDb.modifierGroups.bulkPut(data.modifierGroups as CachedModifierGroup[]);
        if (data.modifierItems?.length) await localDb.modifierItems.bulkPut(data.modifierItems as CachedModifierItem[]);
        if (data.categoryModifierGroups?.length) await localDb.categoryModifierGroups.bulkPut(data.categoryModifierGroups as CachedCategoryModifierGroup[]);
        if (data.menuItemModifierGroups?.length) await localDb.menuItemModifierGroups.bulkPut(data.menuItemModifierGroups as CachedMenuItemModifierGroup[]);
        if (data.tables?.length) await localDb.posTables.bulkPut(data.tables as CachedTable[]);
        if (data.rooms?.length) await localDb.rooms.bulkPut(data.rooms as CachedRoom[]);
        if (data.paymentMethods?.length) await localDb.paymentMethods.bulkPut(data.paymentMethods as CachedPaymentMethod[]);
        // Always replace users fully so pin/permissions are always up-to-date
        if (data.users) {
          await localDb.users.clear();
          if (data.users.length) await localDb.users.bulkPut(data.users as CachedUser[]);
        }

        // Replace local active orders and order items with server snapshot
        if (data.orders) {
          await localDb.orders.clear();
          await localDb.orderItems.clear();
          if (data.orders.length) await localDb.orders.bulkPut(data.orders as CachedOrder[]);
          if (data.orderItems?.length) await localDb.orderItems.bulkPut(data.orderItems as CachedOrderItem[]);
        }

        // Settings: store if present
        if (data.settings) {
          await localDb.settings.put(data.settings as CachedSettings);
        }

        // Shift: store if present, clear if null
        if (data.shift) {
          await localDb.shifts.put(data.shift as CachedShift);
        } else {
          await localDb.shifts.clear();
        }
      }
    );

    await setLastSync(data.serverTime || new Date().toISOString());

    const hasNewData =
      (data.categories?.length || 0) +
      (data.menuItems?.length || 0) +
      (data.tables?.length || 0) +
      (data.orders?.length || 0) +
      (data.rooms?.length || 0) +
      (data.users?.length || 0) > 0;

    return { ok: true, hasNewData };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function usePosSync() {
  const syncRef = useRef(syncPos);
  syncRef.current = syncPos;

  const run = useCallback(async () => syncRef.current(), []);

  useEffect(() => {
    // Initial sync
    run();

    // Sync when coming back online
    const handleOnline = () => run();
    window.addEventListener("online", handleOnline);

    // Periodic sync every 30 seconds
    const interval = setInterval(() => run(), 30000);

    // Sync when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [run]);

  return { sync: run };
}
