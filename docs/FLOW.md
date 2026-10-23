# User flow

How Peaches is laid out: which tab holds what, and the paths through it.
DECISIONS.md #34 has the why in short.

## What was wrong

An audit of every screen at phone width (390px) found the app doing the
right things in the wrong places:

- **One tab did three jobs.** Today stacked a log card, a lineup prompt,
  this week's matchups, stats, upcoming matchups and recent workouts: about
  four screens of scroll, with your own history last. Matchups and logging
  both lit up the Today tab, so neither had a home.
- **"Start" didn't start.** The home card's Start opened a planning page,
  where you pressed Start again. Continuing a workout went the same way
  round.
- **The planning page started at the wrong end.** A 0:00 clock that wasn't
  running, your pledges, and a "What are you doing?" card that did nothing
  came first. Then routines, then six templates, and "Add exercise" was the
  very last thing on the page.
- **History stopped at six.** Older workouts had no way in.
- **Results had no home.** Finished matchups showed only as a W-L tally;
  you couldn't see the weeks you won or lost.
- **A Crate was one long page.** Standings, every week, the activity feed,
  exercises and members sat in a single column on a phone.

## The tabs

| Tab         | Path       | It's for                    | Also lit on         |
| ----------- | ---------- | --------------------------- | ------------------- |
| **Train**   | `/`        | Working out: start, history | `/log`, `/log/:id`  |
| **Compete** | `/compete` | You vs other Peaches        | `/matchups/*`       |
| **Crates**  | `/crates`  | Your groups                 | `/crates/*`         |
| **Profile** | `/profile` | You and the app             |                     |

Train is the home tab, because logging is what people open the app to do.
Every screen orders its content the same way: first what needs you, then
what's live, then what's next, then what's done.

### Train `/`

1. **Workout card**. It changes with the state you're in:
   - Nothing going: **Start a workout** opens the planner. Your saved
     routines sit under it as one-tap chips, so a routine is planned and
     ready with a single tap.
   - Planned, not started: **Start** starts the clock and opens the runner
     straight away. **Edit plan** opens the planner.
   - Under way: shows sets done of total with a progress bar. **Continue**
     goes back into the runner where you left off. **Edit plan** opens the
     planner.
2. **This week**. Workouts, sets and active minutes since Monday, and your
   pledges with how far along each one is. Pledges moved here from the
   planner: they're the week's targets, not a step in planning.
3. **History**. Every workout, grouped by week ("This week", "Last week",
   "Oct 5 – 11"), ten at a time with Show more. A workout in progress is
   marked as such. Swipe right to edit, left to delete with Undo.

### Planner `/log` → runner `/log?mode=log`

The planner reads top to bottom in the order you use it:

- **Empty plan**: the first section is **Build your own**, with Add
  exercise. Then **Your routines**, then **Templates** (with Shuffle). There
  is no clock until the workout starts.
- **With a plan**: **Your workout** is the list (swipe to edit or remove),
  then Add exercise right under it. Start sits in the bottom bar. Save as
  routine stays in the top bar.
- The **runner** works as before. Finish leads to the workout's summary at
  `/log/:id`, which shows totals, points per Crate and exercises, with Edit
  details and Delete.

The **Routine chips** on Train link to `/log?routine=:id`. The planner plans
that routine into the draft, if the draft has no plan yet, then drops the
parameter.

### Compete `/compete`

1. **Needs you**. A *Set your lineup* card for each upcoming matchup whose
   lineup is open and unset.
2. **This week**. The live matchup hero cards.
3. **Coming up**. Scheduled matchups.
4. **Results**. Finished matchups, newest first, each with its score and
   Won/Lost/Tie. Your season record sits in the section header.

If you're in no Crate, Compete says so and links to Crates.

Matchup and lineup pages go back to Compete.

### Crates `/crates` → a Crate `/crates/:id`

The list is unchanged. A Crate keeps what needs you on top: the rules vote
chip, the invite code and disputes needing your vote. Below that, a
segmented control switches between three views. The choice is kept in
`?view=`, so Back and links keep it.

- **Season**: standings and the weeks.
- **Activity**: recent workouts and the exercises members log.
- **Peaches**: the members.

## Paths

- **Log a workout (first time)**: Train → Start a workout → Templates or Add
  exercise → Start → runner → Finish → summary.
- **Log a routine**: Train → tap the routine chip → Start → runner.
- **Pick a workout back up**: Train → Continue (straight into the runner).
- **Fix an old workout**: Train → History → swipe right or tap → edit.
- **Check the score**: Compete → the live hero card → matchup.
- **Set a lineup**: Compete → Set lineup (it's at the top when one is due).
- **See how a Crate's going**: Crates → the Crate → Season.
