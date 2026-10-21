import type { AuthChangeEvent } from "@supabase/supabase-js";
/** A token refresh must not discard an active password recovery flow. */
export function recoveryState(previous: boolean, event: AuthChangeEvent) {
  if (event === "PASSWORD_RECOVERY") return true;
  if (event === "SIGNED_OUT" || event === "SIGNED_IN") return false;
  return previous;
}
