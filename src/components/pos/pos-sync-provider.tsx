"use client";

import { usePosSync } from "@/hooks/use-pos-sync";

export function PosSyncProvider({ children }: { children: React.ReactNode }) {
  usePosSync();
  return <>{children}</>;
}
