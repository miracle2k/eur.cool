"use client";

import { useEffect } from "react";
import { init } from "@plausible-analytics/tracker";

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

    init({
      domain: "eur.cool",
    });

    window.__plausibleInitialized = true;
  }, []);

  return null;
}
