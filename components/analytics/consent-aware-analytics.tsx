"use client";

import { Analytics } from "@vercel/analytics/next";
import { useEffect, useState } from "react";
import {
  analyticsAllowed,
  subscribePrivacyConsent
} from "@/lib/privacy/consent";

export function ConsentAwareAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(analyticsAllowed());
    return subscribePrivacyConsent((consent) => {
      setEnabled(consent?.analytics === true);
    });
  }, []);

  return enabled ? <Analytics /> : null;
}
