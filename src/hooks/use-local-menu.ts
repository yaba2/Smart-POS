"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { localDb } from "@/lib/local-db";
import { buildMenuFromCache, type CategoryData } from "@/lib/sync-utils";

export function useLocalMenu(serverMenu: CategoryData[]): CategoryData[] {
  const localMenu = useLiveQuery(
    () => buildMenuFromCache(),
    []
  );

  // Prefer local data once loaded; fallback to server data on first render
  return localMenu && localMenu.length > 0 ? localMenu : serverMenu;
}

export function useLocalPaymentMethods<T extends { id: string; updatedAt?: string | Date }>(
  serverMethods: T[]
): T[] {
  const localMethods = useLiveQuery(
    () => localDb.paymentMethods.toArray() as unknown as Promise<T[]>,
    []
  );
  return localMethods && localMethods.length > 0 ? localMethods : serverMethods;
}

export function useLocalSettings<T>(serverSettings: T, selector: (row: any) => T): T {
  const localSettings = useLiveQuery(
    () => localDb.settings.toCollection().first().then(selector),
    []
  );
  return localSettings !== undefined && localSettings !== null ? localSettings : serverSettings;
}
