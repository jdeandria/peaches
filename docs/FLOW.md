# User flow

How Peaches is laid out: which tab holds what, and the paths through it.
DECISIONS.md #34 and #35 have the why in short.

## The idea

You plan your week, then work through it. Every workout is planned: it
starts from its day on the plan, even one you decide on the spot (plan it
on today and start it in the same step). Alone, a plan is a planner and
a checklist. In a Crate it's also a bet: what your plan is worth becomes
what you commit to for the week's matchup. Hit it and you earn a bonus on
top; fall short and you lose points for the gap (SCORING.md §3). Your
opponent's plan shows as they make it, so there's a reason to plan big,
and a cost to planning bigger than you'll do.

## The tabs

| Tab        | Path      | It's for                                   | Also lit on                  |
| ---------- | --------- | ------------------------------------------ | ---------------------------- |
| **Plan**   | `/`       | Planning the week and doing it             | `/plan/*`, `/log`, `/log/:id` |
| **Crates** | `/crates` | Crate stats: matchups, standings, activity | `/crates/*`, `/matchups/*`   |
| **You**    | `/you`    | Your history, stats, equipment, settings   |                              |

Plan is the home tab. Every screen orders its content the same way: first
what needs you, then what's live, then what's next, then what's done.

Every screen is also laid out the same way (DECISIONS.md #39): a header
(the title and one line of context), at most one view switcher right under
it, at most one highlighted card for what's live, then sections of the
same list cards, and at most one button pinned at the bottom on screens
that edit. A matchup is the same card wherever it shows. There is one way
to do each thing: tap a row to open it, swipe it left to remove it, drag
it to reorder, and use the tab bar to get to a tab.

Old paths still land somewhere sensible: `/compete` goes to `/crates`,
`/profile` to `/you`, and `/matchups/:id/lineup` to the matchup.

### Plan `/` (and `/?week=next`)

The subtitle is the week and how it's going ("Oct 12 – 18 · 1 of 4
done", or "4 workouts planned" next week). A **This week | Next week**
switch sits under it (kept in `?week=`).

1. **Workout in progress**, if one is going that isn't on the plan: tap to
   continue.
2. **Matchups**, one matchup card per Crate playing that week, tap for
   the matchup:
   - **Next week**, before the lock: your plan's points against your
     opponent's commitment, both live, with the one line that matters ("Plan
     30.5 more to match Cho", "12 ahead of Cho's plan"), what hitting it
     earns, and when plans lock. A bye still shows your plan, which earns
     its bonus.
   - **This week**, locked: each side's live score, on a bar of their
     points so far against what they committed to, and how it stands ("53.3
     to go to hit your plan", "Plan hit: +26.1 bonus").
   - A Crate with no matchup that week gets one line saying so. With no
     Crate at all: "Just for you."
3. **Days**, Monday to Sunday, today marked. If the week is empty and the
   week before had workouts, the heading offers **Repeat last week** (or
   **Repeat this week**), which plans the same workouts on the same
   weekdays. Each day has **+** and its workouts.

The Plan is the one screen for planning and doing: there is no separate
planner.

- **+** on a day opens the exercise picker. An empty day lists whole
  workouts first (**Your routines**, crate-mates' latest workouts tagged
  with who did them, and **Templates**), then exercises. Picking one plans
  a workout on that day at once and opens it. An exercise goes on with
  last time's sets, or a sensible start (three sets of ten, three
  30-second holds, one solid session's distance).
- **A workout** is one row (planned, in progress with sets done, or done
  with what it earned). This week, until it's done, the row leads with a
  play button that starts it, or carries on where it left off, open or
  closed; otherwise it leads with its state (a tick when done). Tapping
  the rest of the row opens it to its exercises. Those under way, and
  today's still to do, start open.
- **Tap an exercise** to set its numbers with − and + (no dials: those
  are for doing the set): **Sets**, then **Reps** and **Weight**, a hold's
  **Time**, or **Distance** and **Time**. A number applies to every set
  (sets that differ keep their other numbers); more sets copy the last.
  It saves a moment after the last tap. Tap it again to close it.
- **Each exercise** has a play button too, this week, that starts the
  workout there: it goes first and the rest follow in order. In a workout under
  way it carries on, showing sets done ("1/3") and a tick for each one
  finished. Swipe an exercise left to remove it (with Undo; the last one
  takes the workout off the plan), hold and drag it to reorder, or add one
  with **Add exercise**. Changes save as they're made.
- **The menu** (⋮) has the rest: **Move to** another day and **Where**
  (once you have equipment locations; it filters the picker), while it's
  not started; **Save as routine**; **Take off the plan** (with Undo).

Play opens the runner (`/log?mode=log`, with `&exercise=` from an
exercise's play), on that exercise if it was an exercise's. Under the
progress bar, a strip of chips, one per exercise with its sets done,
skips around: tap one to do it now (the plan keeps its order and comes
back to it once that exercise is done), hold and drag one to reorder. Between sets the
rest timer pops in between the dials, which already show the next set,
pushing them out to the sides, greyed and still until it's over. **Back to
plan** returns to the Plan, where the workout shows how far along it is;
**Finish** shares it with your Crates and returns there too, the day
showing it done. A finished workout's summary (`/log/:id`, from You →
History) has stat tiles and its exercises, with Edit details and Delete in
the top bar. With nothing launched, `/log` says so. Old planner links
(`/plan/:week/:id`) land on the Plan.

### Crates `/crates` → a Crate `/crates/:id`

`/crates` opens the Crate you looked at last (or the first with a Season
on); with none, it offers Create and Join. A Crate has no back button: its
name is the headline, and tapping it opens **Your Crates**, a sheet to
switch to another, **Create a Crate** or **Join with invite code**. The
subtitle is the Season and its week ("Autumn Kick-off · Week 3 of 6"), and
**Season | Activity | Peaches** sits right under it (kept in `?view=`).

- **Season**: disputes waiting for your vote; **This week**, your matchup
  card (or why there isn't one); **Standings**; **Weeks**, each with your
  opponent and result ("vs Ada · Won 207.2–79.3"); and **Rules**, the
  vote on what each workout is worth.
- **Activity**: recent workouts and every exercise members have logged.
- **Peaches**: the Crate's description, the **invite code** (tap to share
  or copy), the members, and **Bots**. Owners and admins **Add a bot**
  (a name, how hard it trains and what it likes; up to 7) and swipe one
  left to remove it, with Undo. A bot plays from the next Season, and its
  workouts show in Activity like anyone's (its numbers can't be disputed).

The **matchup** page leads with the same matchup card (not a link there),
then how the score adds up (workouts, then plan bonus or penalty), points
by category, disputes, and both sides' workouts.

### You `/you`

Your name, with how many Crates you're in under it, then **Stats |
History | Gear | Settings** (kept in `?view=`; Gear is `equipment`).

- **Stats**: this week's workouts, sets, active minutes and totals, as
  the same stat tiles a workout's summary uses; **plan
  kept** over the last four weeks (planned workouts done of planned, week
  by week); workouts per week; and records (heaviest lifts, longest run,
  ride and swim, most reps in a set).
- **History**: every workout, grouped by week, ten at a time. Tap to open,
  swipe left to delete with Undo.
- **Gear**: where you train and what's there (Home, Gym, Travel presets),
  up to eight places. **Add** to add one, tap one to edit it.
- **Settings**: units; **Account**, with **Sign out** (back to the sign-in
  screen; in the demo, Continue with Google signs back in); **App**:
  install, version.

## Paths

- **Plan next week**: Plan → Next week → + on a day → pick an exercise, a
  routine or a template. Watch the matchup card: plan more to match your
  opponent.
- **Do today's workout**: Plan → play on its row → runner → Finish.
- **Pick a workout back up**: Plan → play on its row (or on the exercise
  to carry on with).
- **Do something you didn't plan**: Plan → + on today → pick → play.
- **Fix an old workout**: You → History → tap it → edit.
- **Check the score**: Crates → This week → tap the matchup card.
- **Vote on the rules**: Crates → Season → Rules.
- **Switch Crates**: Crates → tap the Crate's name.
- **Invite someone**: Crates → Peaches → Code.
- **Play without friends**: Crates → Peaches → Add a bot (a few), then
  Season.
- **Set up your equipment**: You → Gear → Add.
- **Sign out**: You → Settings → Sign out.
