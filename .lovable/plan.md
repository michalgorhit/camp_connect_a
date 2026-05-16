## Goals

1. Fix "Friends this week" so it actually shows friends' camps that overlap each week.
2. Make sharing **per child**, not per (child + camp).
3. Add a "Shared with" screen per child — classes and parent emails (with their kid names) I've shared that child with.
4. End-to-end test the share-invite flow (invite → invitee sees the kid in their list).

---

## Why Friends this week is empty today

Two real bugs:

- `share_invites.invitee_email` is compared **case-sensitively** against `user.email` in `parent.tsx` (`.eq("invitee_email", user.email)`), but the RLS policy lowercases both sides. Auth emails come back capitalized as the user typed them, so the client query returns 0 invites even when RLS would allow it. → switch to `.ilike()` or store/compare lowercased.
- The Friends list also depends on classmate visibility. Current data only seeds a few `share_invites` and a few `share_with_class=true` kids, so even when RLS works, most weeks legitimately have 0 friends. We'll seed more after the refactor so the feature is visibly populated.

---

## Schema changes (migration)

```text
registrations
  - drop column shared_with_class      (sharing is no longer per-camp)

share_invites
  - drop column registration_id        (invites are always per-kid)
  - kid_id: NOT NULL                   (enforce per-child invites)
  - add accepted_by uuid (nullable)    (auth user id once accepted; lets us show their kid names)
  - index (lower(invitee_email))
  - unique (inviter_id, kid_id, lower(invitee_email))   (no dupe invites)
```

RLS updates:

- `regs direct share view`: already keys on `share_invites.kid_id` + `invitee_email` — keep, just confirm lowercase compare.
- Add `regs classmates view all`: already in place.
- New: allow an inviter to see the invitee's kids that the invitee chose to share back. (Optional — for v1 we'll just show the invitee email + "accepted" status. We can defer cross-visibility of their kids.)

---

## App changes

`src/routes/parent.tsx`

- Remove the per-registration share toggle in `RegRow` (the "Share with class" button on each camp).
- Remove the `shared_with_class` checkbox in `RegisterDialog`.
- Replace `InviteDialog` (per-registration) with the existing per-kid `KidShareDialog` — already inserts `share_invites { kid_id, inviter_id, invitee_email }`.
- Fix the visibility query: `.ilike("invitee_email", user.email)` (or store lowercased on insert + compare lowercased).
- Expand the `KidShareDialog` into a **Shared-with manager** per kid that shows:
  - **Class sharing**: checkbox bound to `kids.share_with_class`. If on, list the class name and (optionally) other kids in the class.
  - **Direct invites**: table of `invitee_email`, status (pending / accepted), action to revoke (delete row).
  - Form to add a new email invite + copy link.
- Replace the small "Share2" icon button on each kid card with a "Manage sharing" button that opens this dialog.

`accepted_by` wiring

- Add a tiny effect in the parent dashboard: on load, find `share_invites` where `lower(invitee_email) = lower(user.email) AND accepted_by IS NULL` and update `accepted_by = user.id, accepted_at = now()`. This is what makes the invitee show up on the inviter's "Shared with" list as "accepted".

`Test data` (after migration)

- For each existing parent in the seed set, add a couple of cross-invites so the Shared-with screen has data.
- For Michal's kid Hadar, ensure 3+ classmates (already present) have `share_with_class=true` and registrations across several weeks so multiple weeks light up "Friends this week".
- Verify by querying as Michal (`supabase--read_query` simulating her auth via RLS isn't direct, but we can log in from the UI and verify).

---

## Test checklist

1. Log in as `mommaria@summerbuddy.test` → open `/parent` → expand "Friends this week" on a week where Hadar/Andre/Theo/Gabriel are registered → see their names + camp + price.
2. Log in as Michal → open Hadar's "Manage sharing" dialog → see Mrs. Willis class listed + the test invite to `testfriend@summerbuddy.test`.
3. From Michal's account, invite `mommaria@summerbuddy.test` for Hadar. Log out, log in as Maria → confirm Hadar appears under classmates/friends.
4. Confirm the per-camp "Share with class" button is gone from each registration row.

---

## Open question

For the "Shared with" view, do you want the invitee's **own kid names** to appear back to you once they accept (requires them to opt in / requires us to expose their kid list via a controlled view), or just their **email + acceptance status** for now?
