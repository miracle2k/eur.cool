"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __plausibleInitialized?: boolean;
  }
}

export function PlausibleTracker() {
  useEffect(() => {
    if (window.__plausibleInitialized) {
      return;
    }

    let mounted = true;

    void import("@plausible-analytics/tracker").then(({ init }) => {
      if (!mounted || window.__plausibleInitialized) {
        return;
      }

      init({
        domain: "eur.cool",
      });

      window.__plausibleInitialized = true;
    });

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
