// playerSync.ts — cross-device sync for the Basin's on-device state.
//
// The player profile ("pala_player_profile_v1") and the session check-in history
// ("pala_checkins_v1") live in localStorage so they work signed-out. Once a user
// signs in, we mirror them to a per-user `player_state` row in Supabase so the
// Basin follows them across devices.
//
// Strategy (last-writer-wins for the profile, union for the append-only log):
//  - On sign-in: PULL the remote row, merge into local, then PUSH the union back.
//  - On any local change (palaprofile / palacheckin events): debounced PUSH.
//  - Profile conflicts resolve by `updatedAt` (newest wins).
//  - Check-ins are append-only and keyed by `ts`, so we union + dedupe + keep 60.
//
// initPlayerSync() is idempotent-safe and returns a disposer. No-ops when Supabase
// isn't configured, so it's safe to always call.

import { supabase, supabaseConfigured } from "./supabase";
import { onAuthChange, getCurrentUser } from "./auth";

const PROFILE_KEY = "pala_player_profile_v1";
const CHECKINS_KEY = "pala_checkins_v1";
const TABLE = "player_state";

type AnyProfile = { updatedAt?: number; current?: string; wants?: string[]; level?: string; [k: string]: any };
type AnyCheckin = { ts: number; [k: string]: any };

function readLocal<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
function writeLocalProfile(p: AnyProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent("palaprofile", { detail: p }));
  } catch { /* storage unavailable — ignore */ }
}
function writeLocalCheckins(c: AnyCheckin[]) {
  try {
    localStorage.setItem(CHECKINS_KEY, JSON.stringify(c));
    window.dispatchEvent(new CustomEvent("palacheckin", { detail: null }));
  } catch { /* ignore */ }
}

// union two check-in logs by their timestamp, keep newest 60 (matches addCheckin's cap)
function mergeCheckins(a: AnyCheckin[], b: AnyCheckin[]): AnyCheckin[] {
  const seen = new Set<number>(); const out: AnyCheckin[] = [];
  for (const c of [...a, ...b]) {
    if (!c || typeof c.ts !== "number" || seen.has(c.ts)) continue;
    seen.add(c.ts); out.push(c);
  }
  out.sort((x, y) => x.ts - y.ts);
  return out.slice(-60);
}
const hasProfile = (p: AnyProfile) => !!(p && (p.current || (p.wants && p.wants.length) || p.level));

export function initPlayerSync(): () => void {
  if (!supabaseConfigured || typeof window === "undefined") return () => {};
  let userId: string | null = null;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const push = async () => {
    if (!userId || disposed) return;
    const profile = readLocal<AnyProfile>(PROFILE_KEY, {});
    const checkins = readLocal<AnyCheckin[]>(CHECKINS_KEY, []);
    try {
      await supabase.from(TABLE).upsert(
        { user_id: userId, profile, checkins, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    } catch { /* transient — the next local change re-pushes */ }
  };
  const schedulePush = () => {
    if (!userId) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1200);
  };

  const pull = async (uid: string) => {
    try {
      const { data } = await supabase.from(TABLE).select("profile,checkins").eq("user_id", uid).maybeSingle();
      if (disposed) return;
      const localProfile = readLocal<AnyProfile>(PROFILE_KEY, {});
      const localCheckins = readLocal<AnyCheckin[]>(CHECKINS_KEY, []);
      const remoteProfile: AnyProfile = (data && (data as any).profile) || {};
      const remoteCheckins: AnyCheckin[] = (data && (data as any).checkins) || [];
      // profile: newest wins; only overwrite local if the remote is real + newer
      if (hasProfile(remoteProfile) && (remoteProfile.updatedAt || 0) > (localProfile.updatedAt || 0)) {
        writeLocalProfile(remoteProfile);
      }
      // check-ins: union both sides
      const merged = mergeCheckins(localCheckins, remoteCheckins);
      if (merged.length !== localCheckins.length) writeLocalCheckins(merged);
      // push the reconciled state so the server holds the union
      schedulePush();
    } catch { /* ignore */ }
  };

  const onLocalChange = () => schedulePush();
  window.addEventListener("palaprofile", onLocalChange);
  window.addEventListener("palacheckin", onLocalChange);

  const unsubAuth = onAuthChange((u) => {
    userId = u ? u.id : null;
    if (u) pull(u.id);
  });
  // cover the already-signed-in case (onAuthChange may not replay the current session)
  getCurrentUser().then((u) => { if (!disposed && u && !userId) { userId = u.id; pull(u.id); } });

  return () => {
    disposed = true;
    if (pushTimer) clearTimeout(pushTimer);
    window.removeEventListener("palaprofile", onLocalChange);
    window.removeEventListener("palacheckin", onLocalChange);
    unsubAuth();
  };
}
