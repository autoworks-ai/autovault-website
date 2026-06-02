import { describe, expect, it, vi } from "vitest";
import {
  ClerkApiAuthError,
  clerkAuthRecoveryMessage,
  resolveClerkAuthHeaders
} from "../.vitepress/theme/utils/clerkApi";

describe("Clerk API auth header resolution", () => {
  it("does not call Clerk token retrieval while Clerk is still loading for protected requests", async () => {
    const getToken = vi.fn();

    await expect(resolveClerkAuthHeaders({
      clerkAuthEnabled: true,
      headers: { accept: "application/json" },
      isLoaded: false,
      isSignedIn: true,
      getToken
    }, { required: true, fresh: true })).rejects.toMatchObject({
      reason: "clerk-not-loaded"
    });
    expect(getToken).not.toHaveBeenCalled();
  });

  it("does not call Clerk token retrieval for signed-out protected requests", async () => {
    const getToken = vi.fn();

    await expect(resolveClerkAuthHeaders({
      clerkAuthEnabled: true,
      headers: { accept: "application/json" },
      isLoaded: true,
      isSignedIn: false,
      getToken
    }, { required: true })).rejects.toMatchObject({
      reason: "signed-out"
    });
    expect(getToken).not.toHaveBeenCalled();
  });

  it("requests a fresh token for protected state-changing requests", async () => {
    const getToken = vi.fn(async () => "fresh-session-token");

    await expect(resolveClerkAuthHeaders({
      clerkAuthEnabled: true,
      headers: { "content-type": "application/json" },
      isLoaded: true,
      isSignedIn: true,
      getToken
    }, { required: true, fresh: true })).resolves.toEqual({
      "content-type": "application/json",
      authorization: "Bearer fresh-session-token"
    });
    expect(getToken).toHaveBeenCalledWith({ skipCache: true });
  });

  it("surfaces signed-in token failures before protected requests reach the API", async () => {
    const getToken = vi.fn(async () => null);

    await expect(resolveClerkAuthHeaders({
      clerkAuthEnabled: true,
      headers: { accept: "application/json" },
      isLoaded: true,
      isSignedIn: true,
      getToken
    }, { required: true, fresh: true })).rejects.toMatchObject({
      reason: "token-unavailable"
    });
  });

  it("keeps legacy cookie auth usable when Clerk is disabled", async () => {
    await expect(resolveClerkAuthHeaders({
      clerkAuthEnabled: false,
      headers: { accept: "application/json" },
      isLoaded: false,
      isSignedIn: false,
      getToken: vi.fn()
    }, { required: true })).resolves.toEqual({ accept: "application/json" });
  });

  it("returns user-facing recovery copy for protected auth failures", () => {
    expect(clerkAuthRecoveryMessage(new ClerkApiAuthError("token-unavailable"))).toMatch(/sign in again/i);
    expect(clerkAuthRecoveryMessage(new ClerkApiAuthError("clerk-not-loaded"))).toMatch(/still loading/i);
  });
});
