import { getStore, type StoredUser } from "./store.js";

// ── Single-user mode (SINGLE_USER_MODE=true) ────────────────────────────────
// One fixed local account with full ENTERPRISE access. Created lazily on the
// first authenticated request; afterwards simply looked up. No password, no
// email verification, no plan gates.

export const SINGLE_USER_EMAIL = "you@soundwave.local";
export const SINGLE_USER_NAME = "Creator";

export async function ensureSingleUser(): Promise<StoredUser> {
  const store = await getStore();
  const existing = await store.findUserByEmail(SINGLE_USER_EMAIL);
  if (existing) {
    if (existing.plan !== "ENTERPRISE") {
      return (await store.updateUser(existing.id, { plan: "ENTERPRISE" })) ?? existing;
    }
    return existing;
  }
  return store.createUser({
    email: SINGLE_USER_EMAIL,
    name: SINGLE_USER_NAME,
    passwordHash: null,
    emailVerified: true,
    plan: "ENTERPRISE",
  });
}
