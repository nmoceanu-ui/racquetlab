# Setting up Save & Share + Analytics

Two things need a few minutes of one-time setup before they work on your live site: the database (for Save & Share) and analytics (for usage data). Both are free at your current scale.

---

## Part 1 — Database (Supabase)

### Create the project

1. Go to [supabase.com](https://supabase.com) and sign up (free, no credit card needed).
2. Click **New Project**. Pick any name (e.g. `racquetlab`), set a database password (save it somewhere — you likely won't need it again, but keep it just in case), and pick a region close to where most of your users are.
3. Wait about a minute while it provisions.

### Create the table

1. In your new project, click **SQL Editor** in the left sidebar → **New query**.
2. Open `SUPABASE-SCHEMA.sql` (included in this project folder), copy its entire contents, paste into the editor, and click **Run**.
3. You should see "Success. No rows returned" — that means the table now exists.

### Get your API keys

1. Click **Settings** (gear icon, bottom of sidebar) → **API Keys**.
2. You'll see a **Publishable key** (starts with `sb_publishable_...`). Copy it.
3. On the same page, find your **Project URL** (looks like `https://xxxxx.supabase.co`). Copy it too.

> Note: Supabase recently renamed these — if you see "anon key" instead of "Publishable key," that's the same thing under the old name; either works.

### Add the keys to Vercel

1. Go to your project on [vercel.com](https://vercel.com) → **Settings** → **Environment Variables**.
2. Add two variables:
   - `VITE_SUPABASE_URL` → paste your Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` → paste your Publishable key
3. Click **Save**.
4. Go to the **Deployments** tab and redeploy the latest deployment (click the **⋯** menu on the most recent one → **Redeploy**) so the new environment variables actually take effect — Vercel doesn't apply new env vars to deployments that already happened.

That's it — Save & Share should now work on your live site. The "Save & Share" button in the header will be disabled (grayed out) until both variables are set correctly; if it's still disabled after redeploying, double-check the variable names match exactly (case-sensitive) and that you redeployed after adding them.

### One thing to know about the free tier

Supabase pauses free projects automatically after **one week with no activity**. If your site goes quiet for a week, the next person to load a shared link might see a brief delay or error while it wakes back up — usually resolves itself within a minute, but if it doesn't, log into your Supabase dashboard and click **Resume project**.

---

## Part 2 — Analytics (Vercel Analytics)

This one's simpler — no separate account needed.

1. Go to your project on Vercel → click the **Analytics** tab.
2. Click **Enable**.
3. That's it. The code is already wired up (`@vercel/analytics` is in the app) — once enabled, data starts showing up within a few minutes of real traffic.

### What you'll actually see

Vercel's dashboard shows you page views and visitor counts automatically. Beyond that, this app sends custom events for the things that matter for your specific funnel:

| Event | Fires when | Why it matters |
|---|---|---|
| `finder_completed` | Someone finishes the Smart Finder | Tells you completion rate for the quiz |
| `market_matches_viewed` | Someone reaches the "Closest racquets" results | The step right before any affiliate click would happen |
| `build_saved` | Someone uses Save & Share | Engagement signal — people who save are more invested |
| `build_loaded` | Someone opens a shared link | Tells you the share feature is actually spreading |
| `build_save_failed` | A save attempt errors out | Lets you catch a broken database connection before users complain |
| `mode_changed` | Switching between Player/Pro mode | Tells you which audience is actually using the tool |
| `diagram_mode_changed` | Switching Spec View / Illustration / Profile | Tells you which visual mode people actually want |

These show up in Vercel's Analytics tab under a separate "Custom Events" view once you have some traffic. There's no extra code to write to see them — they're already firing.

---

## If something doesn't work

- **Save & Share button stays disabled**: check the env var names in Vercel match exactly, and that you redeployed after adding them.
- **"That build link doesn't exist" on a link that should work**: the Supabase project may have auto-paused from inactivity — log in and resume it.
- **No custom events showing in Vercel**: custom events can take a little longer to appear than basic page views — give it 10-15 minutes after real traffic, and double check Analytics is actually enabled in the Vercel dashboard.
