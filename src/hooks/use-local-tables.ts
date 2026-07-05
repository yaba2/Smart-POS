"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { buildTablesFromCache, type TableWithOrdersData } from "@/lib/sync-utils";

export function useLocalTables(serverTables: TableWithOrdersData[]): TableWithOrdersData[] {
  const localTables = useLiveQuery(
    () => buildTablesFromCache(),
    []
  );

  // Prefer local data once loaded; fallback to server data on first render
  return localTables && localTables.length > 0 ? localTables : serverTables;
}
