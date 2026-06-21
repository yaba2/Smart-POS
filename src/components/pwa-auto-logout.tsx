"use client";

import { useEffect } from "react";

const LOGOUT_URL = "/api/logout";

export function PWAAutoLogout() {
  useEffect(() => {
    // Sends logout even if the tab/window is being closed.
    const sendLogoutBeacon = () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(LOGOUT_URL, "");
        } else {
          fetch(LOGOUT_URL, { method: "POST", keepalive: true }).catch(() => {});
        }
      } catch {
        // ignore
      }
    };

    // beforeunload: fires when the tab/window closes in normal browser mode.
    const handleBeforeUnload = () => {
      sendLogoutBeacon();
    };

    // pagehide: fires reliably when the PWA window is closed or hidden.
    const handlePageHide = (event: PageTransitionEvent) => {
      // persisted === true means page is entering back-forward cache (not closed)
      if (event.persisted) return;
      sendLogoutBeacon();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return null;
}
