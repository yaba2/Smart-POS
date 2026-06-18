"use client";

import { useEffect } from "react";
import { logout } from "@/actions/auth";

export function PWAAutoLogout() {
  useEffect(() => {
    // Only run in standalone PWA mode
    const isPWA = window.matchMedia("(display-mode: standalone)").matches;
    if (!isPWA) return;

    const handleHide = () => {
      // Fire-and-forget logout when window is closed/hidden in PWA mode
      logout().catch(() => {});
    };

    // pagehide fires reliably when the PWA window is closed
    window.addEventListener("pagehide", handleHide);

    return () => {
      window.removeEventListener("pagehide", handleHide);
    };
  }, []);

  return null;
}
