import "server-only";

import {
  createShippingQuoteService,
  googleRoutesFailureReason,
  type ShippingQuote
} from "@/lib/shipping/service";
import { getEnv } from "@/lib/utils/env";

const shipping = createShippingQuoteService({
  environment: {
    googleMapsServerKey: getEnv("GOOGLE_MAPS_SERVER_KEY"),
    storeAddress: getEnv("FZAC_STORE_ADDRESS"),
    basePrice: getEnv("FZAC_SHIPPING_BASE_PRICE"),
    pricePerKm: getEnv("FZAC_SHIPPING_PRICE_PER_KM"),
    minPrice: getEnv("FZAC_SHIPPING_MIN_PRICE"),
    roundTo: getEnv("FZAC_SHIPPING_ROUND_TO"),
    maxKm: getEnv("FZAC_SHIPPING_MAX_KM")
  }
});

export type { ShippingQuote };
export { googleRoutesFailureReason };

export function canQuoteShipping() {
  return shipping.canQuoteShipping();
}

export function getShippingConfigStatus() {
  return shipping.getShippingConfigStatus();
}

export function quoteDeliveryForAddress(address: Parameters<typeof shipping.quoteDeliveryForAddress>[0]) {
  return shipping.quoteDeliveryForAddress(address);
}
