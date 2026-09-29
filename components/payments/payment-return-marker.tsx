"use client";

import { useEffect } from "react";

export function PaymentReturnMarker() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const ephemeral = ["return", "payment_id", "collection_id", "status", "collection_status"];
    let changed = false;

    for (const key of ephemeral) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  return null;
}
