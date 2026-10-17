# Scoring

How a workout turns into fantasy points, and how a week's matchup is
decided. The code is in `src/app/domain/services/` (`metric-extractor.ts`,
`scoring-service.ts`, `ballot-tally.ts`, `plausibility.ts`) and the
categories in `src/app/domain/models/scoring.ts`. The reasoning is in
[DECISIONS.md](DECISIONS.md) #3, #18, #19 and #23.

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
| Active minutes | min | 45 | Σ timed seconds, or the session length the Peach reported on submit, whichever is more |

An entry's distance kind is copied in when it is logged. For catalog
exercises it comes from `distanceKindOf` (`exercises/loggable.ts`): only
locomotion travels; bikes ride, rowers and pools are swim & row, everything
on foot is run & walk. Carries and crawls count metres but no distance
category, so they score through reps, weight and time.

## 2. Totals become points

```
points(category) = weight(category) × amount / par(category)
total            = Σ points, rounded to 0.01
```

A category's **weight** is the points for one par. With 25 on run & walk, a
5 km run is worth 25 and a 10 km run 50. Points are linear, so a week of
logs scores the same summed per log or all at once.

## 3. Crates vote on the weights

Each member splits a budget of 100 across the six categories (one ballot
per member, changeable any time). The Crate's weights are the mean of its
**current** members' ballots, rounded with the largest-remainder method so
they still add up to 100 (ties go to the earlier category). With no
ballots, the defaults are 20 / 10 / 10 / 20 / 20 / 20.

When a Season is scheduled it copies the current weights into
`season.weights`; every week of that Season scores with them, so changing
a vote never re-scores the past.

## 4. A week decides a matchup

A Round is one week (Monday to Monday in the Crate's time zone). Each side
of a matchup scores the logs its Peach **shared with the Crate** and
**started** in that week. A log's start resets when its first exercise is
recorded. The round stays open for `loggingGraceHours` after the week ends
for late submissions, then `closeRound` stores the result. Results are
final: a log submitted after that changes nothing.

A bye records points-for only. Standings sort by win percentage (ties count
half), then wins, then point differential, then points for.

## 5. Plausibility

Logging is on the honour system, but raw totals make typos decisive, so
`implausibility(entry)` rejects sets with negative numbers, more than 1,000
reps, more than 500 kg, more than 6 hours, more distance than one set can
cover (100 km on foot, 400 km riding, 50 km swimming or rowing, 10 km of
untracked distance), or an average speed faster than humanly possible for
that kind of travel.
