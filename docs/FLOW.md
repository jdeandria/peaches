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
   weekdays. Each day has **+** (plan a workout on it) and its workouts:
   - planned, with what it's worth and **Start** (this week only);
   - in progress, with sets done and **Continue**;
   - done, with what it earned.
   Tap a workout to open it (the planner, or a done one's summary); swipe
   left to take it off the plan (with Undo).

Start launches the workout: a draft log with the planned exercises as its
session plan, straight into the runner (`/log?mode=log`). Between sets the
rest timer pops in between the dials, which already show the next set,
pushing them out to the sides, greyed and still until it's over. Back to
plan in the runner shows the workout's exercises at `/log`, where one can
be added or changed for this session, or dragged into another order.
Finish leads to the workout's summary at `/log/:id` (stat tiles, then the
exercises; Edit details and Delete in the top bar), and the day shows it
done. With nothing launched, `/log` says so.

### Planning a workout `/plan/:week/:id` (`new`, with `?day=`)

The name is the headline, typed over in place (suggested from the
exercises). A new workout goes on the day its **+** was on (the subtitle
says which); one already planned can move with **Day** (Mon to Sun).
**Where** (Anywhere, or one of your equipment locations, shown once you
have one; it filters the exercise picker and fits templates to the kit),
then **Exercises**: Add exercise. While the workout is empty, the picker
lists whole workouts to start from first: **Your routines**, crate-mates'
latest workouts (tagged with who did them) and **Templates**. Each exercise's target
sets are set on the dials, as before. Once there are exercises it shows
what the workout is worth in each Crate with a Season on. Save as routine
and Take off the plan sit in the top bar; **Add to plan** (or Save) in the
bottom bar, and for a workout on today, **Add and start** beside it, which
saves it and goes straight into the runner. Nothing is saved until then.

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
  or copy) and the members.

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
- **Settings**: units, install, sign out, version.

## Paths

- **Plan next week**: Plan → Next week → + on a day → Add exercise (an
  exercise, or a routine or template) → Add to plan. Watch the matchup
  card: plan more to match your opponent.
- **Do today's workout**: Plan → Start on today's workout → runner → Finish.
- **Pick a workout back up**: Plan → Continue on it.
- **Do something you didn't plan**: Plan → + on today → add exercises →
  Add and start.
- **Fix an old workout**: You → History → tap it → edit.
- **Check the score**: Crates → This week → tap the matchup card.
- **Vote on the rules**: Crates → Season → Rules.
- **Switch Crates**: Crates → tap the Crate's name.
- **Invite someone**: Crates → Peaches → Code.
- **Set up your equipment**: You → Gear → Add.
