# User flow

How Peaches is laid out: which tab holds what, and the paths through it.
DECISIONS.md #34 and #35 have the why in short.

## The idea

You plan your week, then work through it. Alone, a plan is a planner and
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

Old paths still land somewhere sensible: `/compete` goes to `/crates`,
`/profile` to `/you`, and `/matchups/:id/lineup` to the matchup.

### Plan `/` (and `/?week=next`)

A **This week | Next week** switch at the top (kept in `?week=`).

1. **Workout in progress**, if one is going that isn't on the plan, with
   Continue.
2. **The week at a glance.** This week: workouts done of planned, with a
   progress bar, and **Log something unplanned** (the quick planner at
   `/log`). An empty week offers **Repeat last week** (or, on next week,
   **Repeat this week**), which plans the same workouts on the same
   weekdays.
3. **Your matchups**, one strip per Crate playing that week (tap for the
   matchup):
   - **Next week**, before the lock: your plan's points against your
     opponent's commitment, both live, with the one line that matters ("Plan
     30.5 more to match Cho", "12 ahead of Cho's plan"), what hitting it
     earns, and when plans lock. A bye still shows your plan, which earns
     its bonus.
   - **This week**, locked: each side's points so far against what they
     committed to, and how it stands ("53.3 to go to hit your plan", "Plan
     hit: +26.1 bonus"), with the live score.
   - A Crate with no matchup that week gets one line saying so. With no
     Crate at all: "Just for you."
4. **Days**, Monday to Sunday, today marked. Each day has **+** (plan a
   workout on it) and its workouts:
   - planned, with what it's worth and **Start** (this week only);
   - in progress, with sets done and **Continue**;
   - done, with what it earned.
   Tap a workout to edit it; swipe right to edit, left to take it off the
   plan (with Undo). Workouts logged without a plan show on their day as
   *Unplanned*.

Start launches the workout: a draft log with the planned exercises as its
session plan, straight into the runner (`/log?mode=log`). Finish leads to
the workout's summary at `/log/:id`, and the day shows it done.

### Planning a workout `/plan/:week/:id` (`new`, with `?day=`)

Name (suggested from the exercises), **Day** (Mon to Sun), **Where**
(Anywhere, or one of your equipment locations; it filters the exercise
picker and fits templates to the kit), then **Exercises**: Add exercise,
or start from **Your routines** or **Templates**. Each exercise's target
sets are set on the dials, as before. Once there are exercises it shows
what the workout is worth in each Crate with a Season on. Save as routine
and Take off the plan sit in the top bar; **Add to plan** (or Save) in the
bottom bar. Nothing is saved until then.

### Crates `/crates` → a Crate `/crates/:id`

`/crates` opens the Crate you looked at last (or the first with a Season
on); with none, it offers Create and Join. A Crate has no back button: a
chip row at the top switches between your Crates, with **Add Crate**.

1. **This week**: your matchup's hero card (live score, and each side's
   points against their plan), or why there isn't one. If the Season starts
   next week, **Plan your week**.
2. What needs you: the rules vote chip, the invite code, and disputes
   waiting for your vote.
3. **Season | Activity | Peaches** (kept in `?view=`). Season has the
   standings, your results and record, what's coming, and the weeks.

The **matchup** page shows the score, how it adds up (workouts, then plan
bonus or penalty), each side's **plan** (committed, how far along, hit or
short), points by category, disputes, and both sides' workouts. Before
the week it shows commitments so far and **Plan your week**; during it,
**Go to your plan**.

### You `/you`

An identity card, then **Stats | History | Gear | Settings** (kept in
`?view=`; Gear is `equipment`).

- **Stats**: this week's workouts, sets, active minutes and totals; **plan
  kept** over the last four weeks (planned workouts done of planned, week
  by week); workouts per week; and records (heaviest lifts, longest run,
  ride and swim, most reps in a set).
- **History**: every workout, grouped by week, ten at a time. Swipe right
  to edit, left to delete with Undo.
- **Gear**: where you train and what's there (Home, Gym, Travel presets),
  up to eight places.
- **Settings**: units, install, sign out, version.

## Paths

- **Plan next week**: Plan → Next week → + on a day → Add exercise (or a
  routine or template) → Add to plan. Watch the strip: plan more to match
  your opponent.
- **Do today's workout**: Plan → Start on today's workout → runner → Finish.
- **Pick a workout back up**: Plan → Continue on it.
- **Log something you didn't plan**: Plan → Log something unplanned.
- **Fix an old workout**: You → History → swipe right or tap → edit.
- **Check the score**: Crates → This week → View matchup.
- **Vote on the rules**: Crates → Rules chip.
- **Set up your equipment**: You → Gear → Add a location (or from the
  workout planner's Where chips).
