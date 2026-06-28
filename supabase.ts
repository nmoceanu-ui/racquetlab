import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// If these aren't set, save/load features fail gracefully (see
// saveBuild/loadBuild below) instead of crashing the whole app — this
// matters because the app should still work as a pure spec-builder even
// before Supabase is configured.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabaseConfigured && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn(
    "RacquetLab: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set. " +
      "Save & Share will be disabled until these are configured. See SUPABASE-SETUP.md."
  );
}
