import { supabase, supabaseConfigured } from "./supabase";

// A build is just a plain JSON snapshot of every spec value the app's
// sliders/selects control — stored as-is in a jsonb column, so new spec
// fields added later don't require a schema migration.
export type SavedBuildResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export type LoadedBuildResult =
  | { ok: true; spec: Record<string, unknown> }
  | { ok: false; error: string };

export type LibraryBuild = {
  id: string;
  code: string;
  name: string;
  spec: Record<string, unknown>;
  project_id: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
};

// Short, URL-safe codes (6 chars) rather than a full UUID in the share link.
function generateShareCode(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i to avoid visual ambiguity
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Derive a friendly default name from whatever spec fields exist, falling
// back to a dated label. Keys are probed defensively since the caller
// passes the full state object.
function defaultName(spec: Record<string, unknown>): string {
  const s = spec as Record<string, any>;
  const shape = s.shapeId ?? s.shape ?? s.headShape;
  const weight = s.weightG ?? s.weight;
  const parts: string[] = [];
  if (shape) parts.push(String(shape).replace(/[-_]/g, " "));
  if (weight) parts.push(`${weight}g`);
  const when = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return parts.length ? `${parts.join(" · ")} — ${when}` : `Build — ${when}`;
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

// Save a build and return its share code. If the visitor is signed in, the
// row is also stamped with their owner id (+ a name and optional project),
// so it shows up in their library automatically. Anonymous saves still work
// exactly as before.
export async function saveBuild(
  spec: Record<string, unknown>,
  opts?: { name?: string; projectId?: string | null }
): Promise<SavedBuildResult> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, error: "Saving isn't set up yet for this deployment." };
  }

  const uid = await currentUserId();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShareCode();
    const row: Record<string, unknown> = { code, spec };
    if (uid) {
      row.owner = uid;
      row.name = opts?.name?.trim() || defaultName(spec);
      if (opts?.projectId) row.project_id = opts.projectId;
    }
    const { error } = await supabase.from("saved_builds").insert(row);
    if (!error) return { ok: true, code };
    // 23505 = unique_violation on the code; retry only on that
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

// ---- Account library (all filtered by owner explicitly for safety) ----

export async function listMyBuilds(): Promise<
  { ok: true; builds: LibraryBuild[] } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: "Not configured." };
  const uid = await currentUserId();
  if (!uid) return { ok: false, error: "Not signed in." };
  const { data, error } = await supabase
    .from("saved_builds")
    .select("id, code, name, spec, project_id, created_at")
    .eq("owner", uid)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, builds: (data ?? []) as LibraryBuild[] };
}

export async function renameBuild(id: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Not configured." };
  const { error } = await supabase.from("saved_builds").update({ name: name.trim() }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteBuild(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Not configured." };
  const { error } = await supabase.from("saved_builds").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setBuildProject(
  id: string,
  projectId: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Not configured." };
  const { error } = await supabase.from("saved_builds").update({ project_id: projectId }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Copy a build shared via ?b=<code> into the signed-in user's library.
export async function importBuild(
  code: string
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const res = await loadBuild(code);
  if (!res.ok) return res;
  const uid = await currentUserId();
  if (!uid || !supabase) return { ok: false, error: "Sign in to add this build." };
  const newCode = generateShareCode();
  const { error } = await supabase.from("saved_builds").insert({
    code: newCode,
    spec: res.spec,
    owner: uid,
    name: `${defaultName(res.spec)} (shared)`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, code: newCode };
}

// ---- Projects ----

export async function listProjects(): Promise<
  { ok: true; projects: Project[] } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: "Not configured." };
  const uid = await currentUserId();
  if (!uid) return { ok: false, error: "Not signed in." };
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, color, created_at")
    .eq("owner", uid)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, projects: (data ?? []) as Project[] };
}

export async function createProject(
  name: string,
  color: string
): Promise<{ ok: true; project: Project } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Not configured." };
  const uid = await currentUserId();
  if (!uid) return { ok: false, error: "Not signed in." };
  const { data, error } = await supabase
    .from("projects")
    .insert({ owner: uid, name: name.trim(), color })
    .select("id, name, color, created_at")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create project." };
  return { ok: true, project: data as Project };
}

export async function renameProject(id: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Not configured." };
  const { error } = await supabase.from("projects").update({ name: name.trim() }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setProjectColor(id: string, color: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Not configured." };
  const { error } = await supabase.from("projects").update({ color }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Deleting a project sets its builds' project_id to null (FK on delete set null),
// so builds fall back to "Personal" rather than being lost.
export async function deleteProject(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Not configured." };
  const { error } = await supabase.from("projects").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
