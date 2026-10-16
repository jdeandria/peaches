# Workout engine

The generator turns *what two Peaches can both do* into a balanced,
time-boxed session, deterministically. It is a pipeline of four small
classes, each testable alone:

```
ExercisePoolService ─► SessionPlanner ─► ExerciseSelector ─► Prescriber
      (who)              (shape)            (which)            (how much)
                                   └──── WorkoutGenerator (time budget) ────┘
```

## 1. Pool: who can do what

* A Peach declares capabilities per exercise (global, not per Crate).
* The pool for a matchup is the **intersection** of the two Peaches' able
  sets, minus the Crate's excluded exercises and joint-stress classes,
  capped at `min(fitness levels) + 1` difficulty.
* Unknown ids (from a removed catalog entry) are dropped silently.

## 2. Plan: the shape of the session

`SessionPlanner` encodes the programming rules as *slots*, each listing
acceptable movement patterns in preference order plus fallbacks:

* Every session is **warm-up → main → conditioning → cool-down**. Warm-up
  draws from mobility work, cool-down from static stretches; neither is
  scored.
* The main block is organised by **movement pattern**, not muscle. Full
  body pairs one knee-dominant with one hip-dominant movement, and always
  pairs **one push with one pull** so shoulder health is protected.
  Upper-body days carry two pushes and two pulls (horizontal and
  vertical). Lower-body days require squat, hinge and single-leg work.
* Each session includes **trunk work**, preferring anti-extension and
  anti-rotation (bracing) patterns over repeated spinal flexion.
* Conditioning volume follows the Crate goal: none on short strength
  days, double on endurance days, dominant on conditioning-focus days.
* Slot count scales with duration (about one main movement per 7 minutes
  of main work). Optional slots (carries, isolation) fill spare time.

## 3. Focus rotation across the season

`FocusRotation` assigns each exercise day a `SessionFocus` from a
goal-specific cycle (general: full body → upper → lower → conditioning).
When two exercise days are **consecutive**, it swaps the next focus so the
same region is never loaded hard two days running (48-hour recovery rule).

## 4. Select: weighted random under constraints

For each slot, every pool exercise with an acceptable pattern gets a
weight, and one is drawn:

| Factor | Effect |
| --- | --- |
| Pattern preference | First-choice pattern 1.0, each later choice less; fallback patterns halved |
| Difficulty fit | Gaussian around the target difficulty (σ = 1 level) |
| Novelty | Used last round ×0.15, two rounds ago ×0.4, three ×0.7 |
| Compound bonus | ×1.4 for multi-joint movements in the main block |
| Muscle overlap | ×0.35 if a primary muscle is already loaded in this block |

Hard rules: no exercise twice, no two from the same progression family
(push-up and archer push-up are the same family), difficulty cap, slot
modality (conditioning slots only take conditioning or power work). A slot
with no candidates is skipped, so a pool of three exercises still yields
a valid (small) workout.

The draw uses `SeededRandom(seed)` (mulberry32) with a per-matchup seed, so re-opening a
round reproduces the identical workout.

## 5. Prescribe: sets, reps, rest, load

Set/rep/rest tables follow the ACSM resistance-training position stand:

| Goal | Sets × reps | Rest | Load guidance |
| --- | --- | --- | --- |
| Strength | 4 × 5 | 120 s | RPE 8 |
| Hypertrophy | 3 × 10 | 75 s | RPE 8 |
| Endurance | 3 × 15 | 45 s | RPE 6 |
| General fitness | 3 × 10 | 60 s | RPE 7 |

Adjustments: bodyweight movements run higher reps (load cannot be added);
isolation work gets one fewer set; holds use 30 s; carries use metres;
unilateral work is prescribed per side. Volume scales ±12 % per level of
target difficulty. Load is expressed as **RPE** so it works for any Peach
without known maxes. Conditioning uses intervals (4, or 6 for endurance)
or one continuous distance effort for locomotion.

## 6. Fit the time budget

The generator estimates duration (3 s per rep, holds at face value,
distance at a pace, rest between sets, 20 s transition) and trims until
it fits: drop optional slots last-first, then shave sets off the longest
scored item (never below two), then drop the lowest-priority scored item.
Warm-up and cool-down are never cut.

## Scoring

Scoring compares a log to the prescription, item by item:

```
achievement = min(achieved / prescribed, maxAchievementRatio)   (default cap 1.25)
item points = pointsPerItem × scoringWeight × achievement       (default 10 per item)
completion bonus = +10 if every scored item reaches 100 %
```

Warm-up and cool-down items have weight 0: logged for the record,
never competed on. Missing or unsubmitted logs score zero. A bye records
points-for only. Standings sort by win percentage (ties count half), then
point differential, then points for.

Because both Peaches do the same workout and are scored relative to it,
absolute strength does not decide matchups; execution does.
