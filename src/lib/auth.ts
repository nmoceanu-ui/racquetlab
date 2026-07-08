import { supabase } from "./supabase";

// Passwordless email OTP auth (the "6-digit PIN" flow). Supabase persists
// the session in localStorage and refreshes it automatically, so once a
// user verifies a code they stay signed in across visits until they sign out.

export type ForjaUser = { id: string; email: string } | null;

export async function sendCode(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Sign-in isn't set up for this deployment yet." };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function verifyCode(email: string, token: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Sign-in isn't set up for this deployment yet." };
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — signing out should never throw into the UI
    }
  }
}

export async function getCurrentUser(): Promise<ForjaUser> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    return u ? { id: u.id, email: u.email ?? "" } : null;
  } catch {
    return null;
  }
}

// Subscribe to sign-in / sign-out. Returns an unsubscribe function.
export function onAuthChange(cb: (user: ForjaUser) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    cb(u ? { id: u.id, email: u.email ?? "" } : null);
  });
  return () => {
    try {
      data.subscription.unsubscribe();
    } catch {
      // ignore
    }
  };
}
