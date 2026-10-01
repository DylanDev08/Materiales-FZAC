import "server-only";

import { createHash } from "node:crypto";

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";

export type LeakedPasswordCheck = {
  checked: boolean;
  compromised: boolean;
  count: number;
};

export async function checkLeakedPassword(password: string): Promise<LeakedPasswordCheck> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      method: "GET",
      headers: {
        "Add-Padding": "true",
        "User-Agent": "Materiales-FZAC/1.0"
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3500)
    });

    if (!response.ok) {
      return { checked: false, compromised: false, count: 0 };
    }

    const body = await response.text();
    for (const line of body.split(/\r?\n/)) {
      const [candidateSuffix, rawCount] = line.trim().split(":");
      if (candidateSuffix?.toUpperCase() !== suffix) continue;

      const count = Number.parseInt(rawCount ?? "0", 10);
      return {
        checked: true,
        compromised: Number.isFinite(count) && count > 0,
        count: Number.isFinite(count) ? count : 0
      };
    }

    return { checked: true, compromised: false, count: 0 };
  } catch {
    return { checked: false, compromised: false, count: 0 };
  }
}
