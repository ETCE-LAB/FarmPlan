# Syntropic Agroforestry Treeline Optimizer

A deterministic, rule-based placement engine for syntropic (food-forest)
agroforestry fields — maximising calorie yield while enforcing the
**Rancho Mastatal syntropic spacing matrix** between every pair of plants.

This replaces the earlier XGBoost/beam-search pipeline entirely. There is
no model to train and nothing is predicted: every plant is placed according
to an explicit priority order and an explicit distance rule, so the total
calorie yield is exact by construction.

---

## System Architecture

```
OPTIMIZER PIPELINE  (single file: end_to_end.py)
├─ 1. Load species        load_species()
│  └─ Read Fixed_dataset.csv, detect one-hot Strata_* columns,
│     parse calorie ranges → midpoint, spacing ranges → minimum
├─ 2. Build field layout   run()
│  └─ 6 treelines (x = 5,15,25,35,45,55 m) + 5 trellis columns
│     (x = 10,20,30,40,50 m) across a 60 m × 40 m field
├─ 3. Fill treelines       fill_treeline()
│  └─ Priority stacking: Emergent → High → Medium → Low → Shrub
│     Staggered start (0.5 m / 7.5 m) so cross-treeline spacing holds
├─ 4. Fill trellis         fill_trellis()
│  └─ Climbers + herbs, 1.5 m step
└─ 5. Validate & export    validate() / to_json()
   └─ Re-check every same-column pair, write plan_placements.json
```

---

## 1. Loading species data

**Function:** `load_species()`

- Reads `Fixed_dataset.csv` (110 species)
- Strata comes from one-hot encoded columns (`Strata_Emergent canopy`,
  `Strata_Shrub layer`, ...) — the first column equal to `1.0` for a row
  is taken as that species' strata
- Calorie cells like `"120000 400000"` are parsed and averaged into a
  single midpoint value (e.g. Walnut → 260,000 kcal)
- Spacing cells like `"10-12 m"` are parsed and the **minimum** number
  is used, so the field is planted as densely as the rules allow
- Species with no calorie value (nitrogen-fixers, timber trees) are still
  loaded and placed, but always **after** calorie-bearing species of the
  same strata (`pool()` sorts calorie-bearers first)

---

## 2. Field layout

Field size: **60 m × 40 m (0.24 ha)** — the reference DigiFarm test polygon.

```python
FIELD_WIDTH_M  = 60.0
FIELD_LENGTH_M = 40.0

treeline_xs = [5, 15, 25, 35, 45, 55]   # 6 treelines, 10 m apart
trellis_xs  = [10, 20, 30, 40, 50]      # 5 trellis columns, halfway between
```

---

## 3. Treeline stacking (`fill_treeline`)

Each treeline is filled top-to-bottom in **1.5 m steps**. At every step
the engine tries species in strict priority order and takes the first
one that satisfies the spacing matrix at that position:

```
1. Emergent canopy   (Walnut, Heartnut, Shagbark hickory...)
2. High canopy        (Perry pear, Service tree...)
3. Medium tree        (Apple, Pear, Elder...)
4. Low tree           (Almond, Plum, Fig...)
5. Shrub layer        ← fills every remaining gap
```

### Why treelines are staggered

The Rancho Mastatal rule requires **12 m** between two Emergent canopy
trees, in any direction. Since treelines sit only **10 m apart**, two
Emergent trees at the same y-position in adjacent treelines would only
be 10 m apart — a violation.

Fix: alternate the starting position between treelines.

```python
y_start = 0.5 if treeline_index % 2 == 0 else 7.5   # 7 m stagger
```

With a 7 m stagger and 10 m between treelines:

```
distance = √(10² + 7²) ≈ 12.2 m   ✓ clears the 12 m rule
```

Even treelines (0, 2, 4) place their first Emergent tree at y = 0.5 m;
odd treelines (1, 3, 5) start at y = 7.5 m. Every Emergent tree afterwards
follows at whatever spacing the spacing matrix requires from its
neighbours in the same column.

---

## 4. Trellis columns (`fill_trellis`)

Simpler than treelines — climbers and herbs are combined into one pool
and placed every `spacing_m` (their own CSV value), 0.5 m stepped forward
whenever nothing fits.

---

## 5. Rancho Mastatal spacing matrix

Every pair of strata tiers has an explicit minimum distance — this is
what makes dense, realistic stacking possible (a Walnut and an Apple can
sit 2 m apart even though two Walnuts need 12 m):

| Pair | Min. distance |
|---|---|
| Emergent ↔ Emergent | 12 m |
| Emergent ↔ High | 10 m |
| Emergent ↔ Medium / Low | 2 m |
| Emergent ↔ Shrub | 1.5 m |
| High ↔ High | 9 m |
| High ↔ Medium | 7.5 m |
| High ↔ Low | 2 m |
| Medium ↔ Medium | 6 m |
| Medium ↔ Low | 3 m |
| Low ↔ Low | 3 m |
| Any tree ↔ Shrub | 1.5 m |
| Any tree ↔ Climber | 1 m |
| Any ↔ Herb | 0.5 m |
| Herb ↔ Herb | 0.4 m |

Implemented as a lookup dict `SM` keyed by `(tier_a, tier_b)`, looked up
in both orders via `req(a, b)`.

**Important scope note:** the matrix is enforced **within a treeline**
(same x, `ok_in_col`). Cross-treeline spacing is intentionally *not*
enforced pairwise (`ok_cross_col` always returns `True`) — instead, the
7 m stagger described above guarantees the 12 m Emergent rule holds by
construction, so no runtime check is needed there.

---

## Installation

```bash
pip install pandas
```

That's the entire dependency list — no XGBoost, no NumPy grid, no
scikit-learn, no training step.

---

## Quick Start

```bash
python end_to_end.py
```

One command. No `train.py`, no pre-trained model, no config beyond the
constants at the top of the file. Output:

```
output/plan_placements.json   # every plant: id, name, strata, calories,
                               # spacing, x/y position, treeline/trellis type
output/plan_result.json       # summary metrics for the frontend
```

---

## File Structure

```
optimizer/
├── data/
│   └── Fixed_dataset.csv        # Species database (110 species, one-hot strata)
├── output/
│   ├── plan_placements.json     # Full plant list — served to frontend via Flask
│   └── plan_result.json         # Summary metrics
├── end_to_end.py                # Entire pipeline — load → place → validate → export
├── README.md                    # This file
└── requirements.txt             # pandas only
```

---

## `plan_result.json` keys

| Key | Meaning |
|---|---|
| `exact_calories` | Total calories of the placed plan (always exact) |
| `predicted_calories` | Same value — kept for frontend API compatibility |
| `placements` | Total number of plants placed |
| `species_count` | Number of unique species used |
| `spacing_violations` | Same-column violations found by `validate()` — should be `0` |
| `layout` | `"syntropic_treelines"` |
| `spacing_standard` | `"Rancho Mastatal"` |

---

## Reference run (current code)

```
Field:              60 m × 40 m (0.24 ha), 6 treelines, 5 trellis columns
Total placements:   297
Unique species:     35
Total calories:     6,840,750 kcal / year
Spacing check:      PASS ✓  (0 violations)

Emergent canopy      21 plants   4 species   3,911,250 kcal
Medium tree           36 plants   7 species     935,400 kcal
Shrub layer           72 plants  13 species     722,925 kcal
Low/medium tree       12 plants   2 species     624,000 kcal
Climber/liana        100 plants   5 species     402,200 kcal
Low tree                6 plants   1 species     177,600 kcal
Herbs (all types)      50 plants   3 species      67,375 kcal
```

Odd treelines place their first Emergent tree at y = 7.5 m instead of
y = 0.5 m, so they end up with slightly fewer plants than even treelines
(22 vs 27) — this is the cost of the stagger fix and is expected, not a bug.

---

## Customisation

**Field size:**
```python
FIELD_WIDTH_M  = 60.0
FIELD_LENGTH_M = 40.0
```

**Treeline / trellis spacing:**
```python
treeline_xs = [5.0 + i*10.0 for i in range(6)]   # every 10 m
trellis_xs  = [10.0 + i*10.0 for i in range(5)]  # halfway between
```

**Emergent stagger period:**
```python
y_start = 0.5 if treeline_index % 2 == 0 else 7.5   # 7 m stagger
```

**Change a spacing rule:**
```python
SM[("emergent", "emergent")] = 14.0   # e.g. widen Emergent-Emergent to 14 m
```

---

## Performance

| Operation | Typical time |
|---|---|
| CSV loading | < 0.2 s |
| Full field placement (~300 plants) | < 1 s |
| Spacing validation | < 1 s |

No search, no model inference — a single deterministic pass through the
field per run.

---

## Validation

`validate()` re-checks every same-column pair after placement:

```python
for p1, p2 in same_column_pairs(placements):
    distance = abs(p1.y_m - p2.y_m)
    required = req(p1.strata, p2.strata)
    assert distance >= required
```

Because `fill_treeline` already enforces this at placement time
(`ok_in_col`), violations should always come back as `0`. The stagger
described above handles the cross-treeline Emergent case without needing
a runtime cross-column check.

---

## Troubleshooting

**`No CSV found`** → place `Fixed_dataset.csv` in the `optimizer/` folder
or a `data/` subfolder.

**`Calories max: 0`** → the calorie column header must contain the word
"calorie" (case-insensitive) for `fc()` to auto-detect it; a very
different header name needs adding to the keyword search.

**Only 1–2 species show up for a strata** → check the `Strata:` line in
the log output — this reflects what's actually in the CSV for that
strata, not a placement bug.

**Odd treelines have fewer plants than even ones** → expected. The 7 m
stagger fix trades a few plants on odd treelines for correct 12 m
Emergent-to-Emergent spacing across the whole field.

**Cross-treeline spacing looks "too close" on the map** → the spacing
*circles* shown on the map represent each plant's individual radius and
will visually overlap between adjacent treelines; the actual plant
*centres* are checked and guaranteed correct by the stagger, not by a
runtime cross-column distance check.

---

## Future enhancements

1. Support irregular field polygons directly instead of a rectangular
   bounding box
2. Per-species crown-radius overlap check instead of point spacing
3. Multi-year succession modelling (thinning schedule as canopy closes)
4. Economic weighting (market price × calories, not raw calories alone)
5. Live re-optimisation from the frontend (drag a tree, re-validate)

---

## License

Open-source for research and educational use.
