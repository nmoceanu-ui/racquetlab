import { supabase, supabaseConfigured } from "./supabase";

// A build is just a plain JSON snapshot of every spec value the app's
// sliders/selects control — no need to enumerate fields here, since the
// caller passes the full state object and we store it as-is in a jsonb
// column. This means new spec fields added later don't require a schema
// migration.
export type SavedBuildResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export type LoadedBuildResult =
  | { ok: true; spec: Record<string, unknown> }
  | { ok: false; error: string };

// Short, URL-safe codes (6 chars, ~56 billion combinations) rather than
// a full UUID in the share link — keeps shared URLs short and readable.
function generateShareCode(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i to avoid visual ambiguity
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function saveBuild(spec: Record<string, unknown>): Promise<SavedBuildResult> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, error: "Saving isn't set up yet for this deployment." };
  }

  // Try a few codes in case of a rare collision (extremely unlikely at
  // this volume, but cheap to guard against).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShareCode();
    const { error } = await supabase.from("saved_builds").insert({ code, spec });
    if (!error) return { ok: true, code };
    // 23505 = Postgres unique_violation; only retry on that, surface anything else immediately
    if ((error as { code?: string }).code !== "23505") {
      return { ok: false, error: error.message };
    }
  }
  return { ok: false, error: "Could not generate a unique share code — please try again." };
}

export async function loadBuild(code: string): Promise<LoadedBuildResult> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, error: "Loading saved builds isn't set up yet for this deployment." };
  }
  const { data, error } = await supabase
    .from("saved_builds")
    .select("spec")
    .eq("code", code.toLowerCase())
    .single();

  if (error || !data) {
    return { ok: false, error: "That build link doesn't exist or may have been removed." };
  }
  return { ok: true, spec: data.spec as Record<string, unknown> };
}
