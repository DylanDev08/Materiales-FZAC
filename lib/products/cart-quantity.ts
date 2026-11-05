/**
 * Ensure the cart never confirms quantities that sanitize() would cap.
 * Positive stock limits confirmed units; zero/unknown stock keeps the existing
 * 999-unit consultation ceiling, subject to checkout availability checks.
 */
export function canAppendCartQuantity(currentQuantity: number, addQuantity: number, stock: number): boolean {
  if (!Number.isInteger(currentQuantity) || currentQuantity < 0) return false;
  if (!Number.isInteger(addQuantity) || addQuantity <= 0) return false;
  const available = Number(stock);
  const limit = Number.isFinite(available) && available > 0 ? available : 999;
  return currentQuantity + addQuantity <= limit;
}
