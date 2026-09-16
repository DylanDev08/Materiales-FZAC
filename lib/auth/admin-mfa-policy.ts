export function isAdminMfaSatisfied(role: string | null | undefined, currentLevel: string | null | undefined) {
  return role === "ADMIN" && currentLevel === "aal2";
}
