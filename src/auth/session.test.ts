import { expect, it } from "vitest";
import { recoveryState } from "./session";
it("preserves recovery across token refresh and clears it on explicit login/logout", () => {
  expect(recoveryState(false, "PASSWORD_RECOVERY")).toBe(true);
  expect(recoveryState(true, "TOKEN_REFRESHED")).toBe(true);
  expect(recoveryState(true, "USER_UPDATED")).toBe(true);
  expect(recoveryState(true, "SIGNED_OUT")).toBe(false);
  expect(recoveryState(true, "SIGNED_IN")).toBe(false);
});
