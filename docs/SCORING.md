# Scoring

How a workout turns into fantasy points, and how a week's matchup is
decided. The code is in `src/app/domain/services/` (`metric-extractor.ts`,
`scoring-service.ts`, `ballot-tally.ts`, `plausibility.ts`), the
categories and rules in `src/app/domain/models/scoring.ts`, lineups in
`models/lineup.ts` and disputes in `models/dispute.ts`. The reasoning is in
[DECISIONS.md](DECISIONS.md) #3, #18, #19, #23 and #24–#28.

A week's score has three parts, and the matchup page shows each one per
side:

```
week score = workout points + pledge bonuses + battles
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

## 3. Lineups add pledges and battles

Before each week starts, a Peach sets a **lineup**: up to `slots`
categories, each with a **pledge** (an amount they commit to that week). It
can change until the week starts (Monday 00:00 in the Crate's zone), when
it locks. Crate-mates can't see it until then, so opponents plan around a
guess (the lineup page shows each side's recent weekly averages as a hint).
A lineup carries over to later weeks until it is changed. Lineups open a
week before their week starts.

For each pledge in category `c` with target `T`, where `mine` and `theirs`
are each side's amount of `c` that week:

```
pledge bonus = mine ≥ T ? pledgeBonus% × weight(c) × T / par(c) : 0
battle       = mine > theirs ? battlePars × weight(c)
             : mine = theirs > 0 ? battlePars × weight(c) / 2
             : 0
```

* A pledge pays only if it is hit, and pays in proportion to its size: a
  bigger pledge is worth more but is easier to miss.
* A battle is won by doing more of that category than the opponent,
  whatever they pledged. If both pledge the same category, both battle in
  it and only one can win; pledging a category the opponent neglects is an
  easier battle. A bye has no battles.

Worked example (weights: run & walk 25, weight moved 20, active minutes 20;
rules: 3 slots, 50% bonus, one-par battles):

| Pledge | Did | Opponent did | Pledge bonus | Battle |
| --- | --- | --- | --- | --- |
| Run & walk 15 km | 16.2 km | 9 km | hit: 50% × 75 = 37.5 | won: 25 |
| Weight moved 10,000 kg | 8,400 kg | 12,000 kg | missed: 0 | lost: 0 |
| Active minutes 180 | 195 min | 140 min | hit: 50% × 80 = 40 | won: 20 |

Workout points 81 + 33.6 + 86.67 = 201.27, so the week is
201.27 + 77.5 + 45 = 323.77.

## 4. Crates vote on the rules

Each member's ballot holds both halves of the rules, and can change any
time:

* **Weights**: the member splits a budget of 100 across the six
  categories. The Crate's weights are the mean of its **current** members'
  ballots, rounded with the largest-remainder method so they still add up
  to 100 (ties go to the earlier category). With no ballots, the defaults
  are 20 / 10 / 10 / 20 / 20 / 20.
* **Lineup rules**: `slots` (0–6; 0 turns lineups off), `pledgeBonus`
  (0–100%) and `battlePars` (0–3). Each is the **middle** vote (the lower of
  the two middle votes when there is an even number), so one extreme
  ballot can't drag it. With no ballots: 3 slots, 50%, 1 par.

When a Season is scheduled it copies the current rules into
`season.rules`; every week of that Season scores with them, so changing a
vote never re-scores the past.

## 5. A week decides a matchup

A Round is one week (Monday to Monday in the Crate's time zone). Each side
of a matchup scores the logs its Peach **shared with the Crate** and
**started** in that week, less anything the Crate struck (§6), plus its
lineup. The round stays open for `loggingGraceHours` after the week ends
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
