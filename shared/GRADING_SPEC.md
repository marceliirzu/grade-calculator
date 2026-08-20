# Grading Specification v1

This document is **normative**. Two independent implementations must satisfy it:

| Implementation | Location | Used by |
|---|---|---|
| C# | `backend/GradeCalculator.API/Grading/` | Signed-in users (Railway MySQL) |
| JavaScript | `frontend/src/core/grading/` | Guest mode (browser localStorage) |

Both are verified against the same golden vectors in `shared/grade-vectors.json`.
A change to either implementation that is not accompanied by a matching change to
this document and the vector file is a defect.

---

## 1. Definitions

- **item** — one graded artifact: `{ pointsEarned: decimal|null, pointsPossible: decimal, sortOrder: int, id: int }`.
- **graded item** — an item where `pointsEarned != null` **and** `pointsPossible > 0`.
  Items failing either condition are excluded from every calculation. An item with
  `pointsEarned != null` and `pointsPossible == 0` is *malformed*, not a zero-weight item;
  it is silently excluded rather than treated as a divide-by-zero.
- **itemPercent(i)** = `pointsEarned / pointsPossible * 100`, defined only for graded items.
  It is **not** clamped: extra credit legitimately exceeds 100.

## 2. Deterministic ordering

Every sort in this spec is total, so results never depend on input order or on whether the
language's sort is stable. Two explicit comparators are used, and **only `itemPercent`
inverts between them** — the tie-breakers are byte-for-byte identical in both directions:

```
worstFirst: itemPercent ASC,  pointsPossible DESC, sortOrder ASC, id ASC
bestFirst:  itemPercent DESC, pointsPossible DESC, sortOrder ASC, id ASC
```

Implementations must write these comparators out explicitly. Do **not** implement `bestFirst`
as "sort `worstFirst` then reverse" — that also flips `sortOrder` and `id`, so two items with
the same percentage would be dropped in one order and kept in the other.

Ranking equal percentages by `pointsPossible DESC` means that when a 8/10 quiz and an 80/100
exam both sit at 80%, the *exam* is the one drop-lowest removes. Dropping the higher-stakes
item is the choice that helps the student, which is the tie-break they would pick themselves.

## 3. Rule application

Rules are applied to the graded items of a category in this fixed order, regardless of the
order they were created in:

1. `DropLowest(n)` — sort ascending by the canonical key, remove the first `n`.
   If `n >= count`, the result is **empty** (not "keep one").
2. `CountHighest(k)` — sort descending, keep the first `k`. If `k >= count`, keep all.
3. `WeightByScore` — does not filter items; see §4.

`n` and `k` are clamped to `>= 0`. Duplicate rules of the same type are applied in `id` order.
The surviving set is called the **counted items**.

## 4. Category percentage

Let `C` be the counted items.

- If `C` is empty → category percentage is **null** (the category is *ungraded*).
- If a `WeightByScore` rule exists **and** its weight list length equals `|C|`:
  sort `C` descending by the canonical key and compute
  `Σ(itemPercent_i × weight_i) / Σ(weight_i)`.
  A zero weight-sum falls back to the points-based branch below.
- Otherwise (**points-based**, the default):
  `Σ(pointsEarned) / Σ(pointsPossible) × 100`.

> **Length mismatch is not silently truncated.** Earlier behaviour dropped every item beyond
> the end of the weight list, so adding a 5th exam to a 4-weight rule made that exam vanish
> from the grade. A mismatch now falls back to points-based aggregation and raises a
> `WeightByScoreLengthMismatch` warning on the result.

Note that drop/count rules rank by **percentage** while the default aggregation sums **points**.
This is intentional and matches how mainstream gradebooks behave, but it means the two steps
use different units — documented here so it is a decision rather than an accident.

## 5. Class percentage

Over categories where `weight > 0` **and** the category percentage is non-null:

```
classPercent = Σ(weight_c × categoryPercent_c) / Σ(weight_c)
```

If no category qualifies, the class percentage is **null**.

The denominator is the sum of *participating* weights, not 100. A class whose weights sum to
60 because the rest of the term has not happened yet reports a grade over the graded 60 —
this is "grade so far" semantics, and it is why an ungraded category cannot drag a grade down.

## 6. Letter grade

The highest band whose minimum threshold is `<= classPercent`, checked A+ → D-; anything
below the D- threshold is `F`. Comparison uses the percentage rounded **half-away-from-zero to
4 decimal places**, which removes accumulated decimal noise without moving a genuine 89.96
up to an A-. Thresholds are per class and user-editable.

## 7. GPA

- **Class GPA** — the GPA points for the class's letter grade, read from *that class's* scale.
  `A+` yields the scale's `aPlusGpaValue` (4.0 or 4.33); every other letter is fixed:
  `A 4.0, A- 3.67, B+ 3.33, B 3.0, B- 2.67, C+ 2.33, C 2.0, C- 1.67, D+ 1.33, D 1.0, D- 0.67, F 0.0`.
  A class with a null percentage has a null GPA.
- **Semester / cumulative GPA** — credit-weighted mean over classes with a non-null GPA:
  `Σ(classGpa × creditHours) / Σ(creditHours)`, **rounded half-away-from-zero to 2 decimals**.
  Classes with a null GPA are excluded from both numerator and denominator. If the
  participating credit total is 0, the result is **null** — never `0.0`, which would read as
  a catastrophic GPA rather than "nothing graded yet".

## 8. Rounding

Intermediate arithmetic is never rounded. `decimal` (C#) and IEEE-754 double (JS) are used
end to end; the vectors compare percentages with a tolerance of `1e-6` to absorb the
difference between the two numeric models. Only two roundings are semantic:

| Value | Rounding |
|---|---|
| percentage used for letter-band comparison | 4 dp, half away from zero |
| semester / cumulative GPA | 2 dp, half away from zero |

Class GPA is *not* rounded — it is already an exact table value.

## 9. Target grade

Given a target letter, its threshold `T`, and the set of ungraded items, find the minimum
uniform percentage `X` that every remaining item must score for the class percentage to reach `T`.

`classPercent(X)` is monotonically non-decreasing in `X` — raising the score of pending work
cannot lower a grade, and that remains true under drop-lowest, which is why the solver is a
**bisection on [0, 200]** rather than a closed-form solve. A linear solve is only valid when no
drop/count rules are present; bisection is correct in both cases, so there is one code path.

- No ungraded items → `needed = null`, `status = Determined`.
- `classPercent(0) >= T` → `status = Secured` (the target holds even if all remaining work scores 0).
- `classPercent(100) < T` → `status = Unreachable`, and `needed` still reports the value above
  100 that would have been required, so the UI can say *how far* out of reach it is.
  Note the asymmetry with §1: extra credit above 100% is legal on an *item*, but a target that
  **requires** it is reported as out of reach rather than achievable, because a student cannot
  plan around extra credit that may not be offered. Unreachability is therefore judged at
  `X = 100`, never at the top of the bisection range.
- Otherwise → `status = Achievable`.

`needed` is reported to 2 dp and always rounded **up** — reporting a score that would miss the
target is the one error mode that matters here. Bisection runs until the bracket is narrower
than `1e-9`, then:

```
needed = ceil((X - 1e-7) * 100) / 100
```

The `1e-7` nudge stops a bisection result of `86.0000000001` from being reported as `86.01`.
It costs at most 0.0001 percentage points of understatement, which is far below the precision
any gradebook actually offers.

Ungraded items are assumed to keep their stated `pointsPossible`. A category with no items at
all contributes nothing and cannot be "scored on"; its weight is excluded from the projection,
matching §5.
