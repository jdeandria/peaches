# Scoring

How a workout turns into fantasy points, and how a week's matchup is
decided. The code is in `src/app/domain/services/` (`metric-extractor.ts`,
`scoring-service.ts`, `ballot-tally.ts`, `plausibility.ts`), the
categories and rules in `src/app/domain/models/scoring.ts`, plans in
`models/week-plan.ts` and `models/commitment.ts` (kept in step by
`application/plan-service.ts`) and disputes in `models/dispute.ts`. The
reasoning is in [DECISIONS.md](DECISIONS.md) #3, #18, #19, #23, #24–#28
and #35.

A week's score has three parts, and the matchup page shows each one per
side:

```
week score = workout points + plan bonus (or − plan penalty)
```

## 1. A log becomes category totals

`MetricExtractor.extract(log)` reads only the numbers in the sets, so
catalog and custom exercises score alike:

| Category | Unit | Par | From |
| --- | --- | --- | --- |
| Run & walk | km | 5 | metres on entries whose distance kind is `runWalk` |
| Ride | km | 20 | metres on `ride` entries |
| Swim & row | m | 2,000 | metres on `swimRow` entries |
| Weight moved | kg | 5,000 | Σ reps × load over every set |
| Reps | reps | 150 | every rep, loaded or not |
| Active minutes | min | 45 | Σ timed seconds, or the session's time on the clock, whichever is more |

An entry's distance kind is copied in when it is logged. For catalog
exercises it comes from `distanceKindOf` (`exercises/loggable.ts`): only
locomotion travels; bikes ride, rowers and pools are swim & row, everything
on foot is run & walk. Carries and crawls count metres but no distance
category, so they score through reps, weight and time. Exercises a Peach
makes up while logging choose how they are logged (reps, reps with weight,
time, or distance of a kind), which decides how they score.

The session clock runs while the log screen is open and pauses when it is
closed or the app is in the background; the Peach can correct it later.

## 2. Totals become workout points

```
points(category) = weight(category) × amount / par(category)
workout points   = Σ points, rounded to 0.01
```

A category's **weight** is the points for one par. With 25 on run & walk, a
5 km run is worth 25 and a 10 km run 50. Points are linear, so a week of
logs scores the same summed per log or all at once.

## 3. Plans add a bonus, or a penalty

A Peach plans their week: workouts on days, each a list of exercises with
target sets. In each Crate they play in, what that plan is worth under the
Season's weights is their **commitment** for the week's matchup:

```
planned points = points(the planned sets, in a session as long as planned)
```

The planned sets score like logged ones (§1–2). A plan has no clock, so
its session time is estimated: two minutes for each set without a time
(the set and its rest), a timed set's time plus a minute's rest, and a
distance's own time. Active minutes then come from that, as they would
from the clock on the day. One plan counts in every Crate, each pricing it
with its own weights.

The commitment follows the plan until the week starts (Monday 00:00 in the
Crate's zone), then **locks**. After that the Peach can still move and
change workouts, but not what they committed to. Commitments open a week
before their week (so: next week's, during this one) and are written by
the Peach's own device whenever their plan changes, or on the next sync if
a Season was scheduled after they planned. Crate-mates see each other's
commitments as they change (only the number; plans stay private), so
opponents plan against each other until the lock.

With `committed` points and `earned` workout points that week:

```
plan = earned ≥ committed ?  bonus% × committed
                           : −penalty% × (committed − earned)
```

* Without a plan (committed 0) there is no bonus and no penalty.
* Planning bigger raises the bonus but makes it easier to miss, and every
  point missed costs. During the week the live score shows the penalty
  for what's still to do, as if the week ended now.
* A bye scores its plan too; it just has no opponent.

Worked example (weights: run & walk 25, weight moved 20, active minutes 20;
rules: 25% bonus, 50% penalty). Workouts: 16.2 km, 8,400 kg and 195 min,
so 81 + 33.6 + 86.67 = 201.27 points.

| Committed | Hit? | Plan | Week |
| --- | --- | --- | --- |
| 180 | yes | +25% × 180 = +45 | 246.27 |
| 261.27 | 60 short | −50% × 60 = −30 | 171.27 |
| 0 | no plan | 0 | 201.27 |

## 4. Crates vote on the rules

Each member's ballot holds both halves of the rules, and can change any
time:

* **Weights**: the member splits a budget of 100 across the six
  categories. The Crate's weights are the mean of its **current** members'
  ballots, rounded with the largest-remainder method so they still add up
  to 100 (ties go to the earlier category). With no ballots, the defaults
  are 20 / 10 / 10 / 20 / 20 / 20.
* **Plan rules**: `bonus` (0–100%) and `penalty` (0–100%). Each is the
  **middle** vote (the lower of the two middle votes when there is an even
  number), so one extreme ballot can't drag it. With no ballots: 25% bonus,
  50% penalty, so missing costs more than hitting earns.

When a Season is scheduled it copies the current rules into
`season.rules`; every week of that Season scores with them, so changing a
vote never re-scores the past.

## 5. A week decides a matchup

A Round is one week (Monday to Monday in the Crate's time zone). Each side
of a matchup scores the logs its Peach **shared with the Crate** and
**started** in that week, less anything the Crate struck (§6), plus its
plan bonus or penalty (§3). The round stays open for `loggingGraceHours` after the week ends
for late logs and dispute votes, then `closeRound` stores the result.
Results are final: logging, editing or striking anything after that
changes nothing.

A bye records points-for only. Standings sort by win percentage (ties count
half), then wins, then point differential, then points for.

## 6. Disputes

Any member can dispute one exercise of a crate-mate's shared workout, or
its session time, while that week is still open. Members vote **strike** or
**keep** (the opener's vote is strike); the workout's owner counts as keep.

```
struck once  strikes > members / 2
kept once    a strike majority is no longer possible
```

Members are the Crate's current active members. A struck exercise stops
scoring in that Crate (a struck session time counts as zero, so active
minutes come from timed sets only); other Crates are unaffected. A dispute
is about the numbers as they were when it was raised: if the owner edits
them, it no longer applies. Disputes still open when the week closes change
nothing.

## 7. Plausibility

Logging is on the honour system, but raw totals make typos decisive, so
`implausibility(entry)` rejects sets with negative numbers, more than 1,000
reps, more than 500 kg, more than 6 hours, more distance than one set can
cover (100 km on foot, 400 km riding, 50 km swimming or rowing, 10 km of
untracked distance), or an average speed faster than humanly possible for
that kind of travel. A session's clock is capped at 10 hours.
