# Camps platform expansion

## 1. Database (one migration)

- Add `'admin'` value to `app_role` enum.
- Add columns to `camp_sessions`:
  - `created_by uuid` (who added it)
  - `source` text — `'vendor' | 'admin' | 'community'`
  - `day_type` text — `'half_day' | 'full_day' | 'multi_week'`
  - `capacity_known` bool (false when a parent adds it; admin/vendor flip true when setting capacity)
- RLS updates:
  - Anyone authenticated can INSERT a `camp_sessions` row (community-added, `capacity` forced NULL, `capacity_known=false`, `vendor_id = created_by`).
  - Admins can SELECT/UPDATE/DELETE any session, view all registrations, and reassign `vendor_id`.
  - Vendors keep current rights on rows where they are `vendor_id`.
  - Only admin/vendor of the row can set `capacity` / `available_spots`.
- Seed: grant `admin` role to `michalgorhit@gmail.com` (if the user exists; otherwise it gets granted on first sign-in via a small trigger or manual follow-up).

## 2. Browse page (`/sessions`)

Add filter bar:

- Age range slider (5–18)
- Week picker (multi-select of summer 2026 weeks)
- Length: Half-day / Full day / Multi-week (checkbox group)
- Existing area search stays

Each card shows the new "Community added — capacity unknown" pill when applicable.

## 3. Parent flow — "Add a camp"

New "Add a camp" button on `/sessions` and on the parent dashboard "Register" dialog. Flow:

1. Type the camp name.
2. Live search of existing `camp_sessions` by similar title (ilike + trigram-ish ordering) — user must scroll the matches before the "Create new" button enables.
3. On create: insert with `source='community'`, `capacity_known=false`, `available_spots=null`, dates + location + age range + day_type from the form.
4. Auto-register the parent's selected kid.

## 4. Vendor dashboard (`/vendor`)

- List of their camps with per-camp interest/registered counts.
- Edit dialog: capacity, available spots per week, dates, age range, day type, publish toggle.
- "Claim camp" panel: shows community-added camps with similar names so vendor can request admin to attach them.

## 5. Admin dashboard (`/admin`, new route)

- Guarded by `_authenticated` + admin role check.
- Table of every camp: title, vendor (or "community"), dates, registered count, interested count, capacity.
- Row actions: Edit, Assign vendor (dropdown of vendor profiles), Delete.
- Top metrics: total camps, total registrations, total interest.

## 6. Header / nav

- Show "Admin" link when role includes admin.
- Keep existing Parent / Vendor links.

## Technical notes

- All counts pulled via `createServerFn` with `requireSupabaseAuth` + admin check (uses `supabaseAdmin` for cross-user reads only inside admin fn after verifying role).
- Vendor counts come from existing `regs vendor view own session` RLS — no admin client needed.
- Filters are client-side over the existing fetched list (dataset is small).
- "Similar camp name" search uses `ilike '%word%'` on each token; good enough at current data scale.
- No changes to share/friends features.

## Out of scope (not in this change)

- Email notifications when vendor claims a community camp.
- Waitlist when capacity hits zero.
- Per-week availability granularity beyond a single `available_spots` integer (multi-week camps still use one number).
