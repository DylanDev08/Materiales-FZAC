"use client";

import { Analytics } from "@vercel/analytics/next";
import { useSyncExternalStore } from "react";
import {
  analyticsAllowed,
  subscribePrivacyConsent
} from "@/lib/privacy/consent";

function subscribeAnalytics(listener: () => void) {
  return subscribePrivacyConsent(() => listener());
}

function analyticsSnapshot() {
  return analyticsAllowed();
}

function serverAnalyticsSnapshot() {
  return false;
}

export function ConsentAwareAnalytics() {
  const enabled = useSyncExternalStore(
    subscribeAnalytics,
    analyticsSnapshot,
    serverAnalyticsSnapshot
  );

  return enabled ? <Analytics /> : null;
}
