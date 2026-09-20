// Legacy endpoint kept for backwards compatibility.
// Reuse the canonical checkout handler so security, validation and throttling cannot drift.
export { POST } from "./create/route";
