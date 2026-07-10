# Syntropic Agroforestry XGBoost Optimizer

A gradient-boosted scoring system for optimising plant placement in syntropic
(food-forest) agroforestry fields — maximising calorie yield while enforcing
species-specific and syntropic minimum spacing constraints.

---

## System Architecture

```
OPTIMIZER PIPELINE
├─ Phase 1: Data Validation       data_loader.py
│  └─ Load 110 species, derive Strata / calories_min / spacing_m
├─ Phase 2: Constraint Sampler    constraint_sampler.py
│  └─ 2D grid + rejection sampling (50 cm cells)
├─ Phase 3: Strata Orchestration  strata_optimizer.py
│  └─ Hierarchical placement (emergent canopy → groundcover)
├─ Phase 4: XGBoost Scorer        models.py / train.py
│  └─ Species-count features → XGBRegressor → scalar kcal
└─ Phase 5: End-to-End            end_to_end.py
   └─ Beam search (50 candidates) → best plan → export
```

---

## Phase 1: Data Validation
**File:** `data_loader.py`

- Loads `data/Fixed_dataset_corrected.csv` (110 species, 17 strata)
- The fixed CSV already contains pre-parsed columns:
  `Strata` (text), `calories_min` (float), `spacing_m` (float)
- Falls back to reconstructing those columns from raw range strings
  (`Strata_*` hot-encoded columns, `Expected annual calories …` ranges)
  if pointed at the original planning CSV
- Validates calorie (80%) and spacing (100%) data completeness

**Output:**
- 88 species with complete calorie + spacing data
- 17 distinct strata from emergent canopy to aquatic herbs

---

## Phase 2: Classical Constraint Sampler
**File:** `constraint_sampler.py`

Rejects placements that violate spacing constraints:
- 2D occupancy grid of 50 cm × 50 cm cells
- Rejection sampling: randomly propose cells, check pairwise distances
- Tracks all planted species and their minimum spacing requirements
- Syntropic default minimum: 1.0 m between all plants
- Zero-spacing guard: `spacing_m` is clamped to `syntropic_min_spacing_m`
  inside `generate_viable_placements()` so broadcast-seeded herbs never
  stack on the same cell

**Key Methods:**
- `generate_viable_placements()` → up to 100 valid placement candidates
- `check_spacing_constraint()` → validates distance rules
- `place_species()` → re-validates before committing to grid
- `get_grid_state()` → exports occupancy as NumPy array

---

## Phase 3: Strata Orchestration
**File:** `strata_optimizer.py`

Hierarchical placement from highest to lowest stratum:
1. For each stratum (top to bottom), randomly select
   `target_species_per_strata` species
2. Generate up to 100 viable placements via rejection sampling
3. Place 1–3 instances per species from *distinct* viable positions
4. Higher-stratum placements constrain lower strata automatically
5. Calorie totals computed in O(N) directly from `sampler.placements`

**Output:** Valid plans with exact calorie sums as ground truth

---

## Phase 4: XGBoost Scoring
**Files:** `models.py`, `train.py`

**CalorieScoringModel:**
- Input: species-count vector + 4 summary features
  (`placement_count`, `unique_species_count`, `grid_width`, `grid_height`)
- Architecture: `XGBRegressor` (400 trees, depth 4, lr 0.05)
- Output: scalar predicted total calories
- Serialisation: model saved as JSON; metadata (species list, feature names,
  hyperparameters) saved as a companion `.meta.json` — all values are
  Python-native types (no NumPy serialisation errors)

**Training Data:**
- Generated from Phase 3 classical sampler
- Default: 100 training plans, 30 validation plans
- Plans range: ~200 K – 2.4 M kcal per 50 m × 50 m field

**Metrics Tracked:** MAE, RMSE, MAPE

---

## Phase 5: End-to-End Optimiser
**File:** `end_to_end.py`

Combines all components:
1. Load trained `CalorieScoringModel` (JSON + metadata)
2. Generate `n_candidates` random plans via `StrataOptimizer`
3. Score each with the XGBoost model (< 1 ms per plan)
4. Select best plan by predicted calories
5. Validate all spacing constraints post-hoc (zero violations guaranteed)
6. Export plan as JSON + NumPy grid

**Result dict keys** (unified across all callers):
- `predicted_calories` — XGBoost score of the best plan
- `exact_calories`     — ground-truth sum from species database
- `prediction_error`  — absolute difference
- `error_pct`         — percentage error

---

## Installation

```bash
# Core dependencies
pip install xgboost pandas numpy tqdm

# Optional (visualisation)
pip install matplotlib jupyter
```

> No PyTorch required — the scoring model is XGBoost, not a CNN.

---

## Quick Start

### 1. Validate Species Data
```bash
python data_loader.py
```
Shows species counts by category / strata and data quality metrics.

### 2. Train Scoring Model
```bash
python train.py
```
Generates 100 training + 30 validation plans, trains XGBoost regressor.
Saves to `models/calorie_scoring_model.json` and
`models/calorie_scoring_model.meta.json`.

### 3. Optimise Field Plan
```bash
python end_to_end.py
```
50-candidate beam search, constraint validation, exports plan to `output/`.

### 4. Quick Demo (no pre-trained model required)
```bash
python demo.py
```

### 5. Analyse Results
```bash
jupyter notebook notebooks/analysis.ipynb
```

---

## File Structure

```
optimizer/
├── data/
│   └── Fixed_dataset_corrected.csv              # Species database (110 species)
├── models/
│   ├── calorie_scoring_model.json               # Trained XGBoost model
│   ├── calorie_scoring_model.meta.json          # Species list + feature names
│   └── metrics.json                             # Train / val metrics
├── output/
│   ├── grid_visualization.npy                   # Occupancy grid (numpy)
│   ├── plan_result.json                         # Plan metadata
│   └── demo_results.json                        # Demo output
├── notebooks/
│   └── analysis.ipynb                           # Visualisation notebook
├── data_loader.py                               # Phase 1
├── constraint_sampler.py                        # Phase 2
├── strata_optimizer.py                          # Phase 3
├── models.py                                    # Phase 4 (model class)
├── train.py                                     # Phase 4 (training pipeline)
├── end_to_end.py                                # Phase 5
├── demo.py                                      # Quick demo
├── README.md                                    # This file
└── IMPLEMENTATION_SUMMARY.md                    # Detailed phase notes
```

---

## Algorithm Details

### Constraint Sampling
For each species placement attempt:
1. Sample a random empty cell from the grid
2. Compute pairwise distances to all existing placements within the
   search radius `max(spacing_m, syntropic_min_spacing_m)`
3. Accept if `distance ≥ max(new_spacing, existing_spacing, syntropic_min)`
4. Reject otherwise; repeat until `max_viable` placements found or
   `max_candidates` exhausted

### Strata Hierarchy
```
Emergent canopy    (9 species)   ← placed first, largest spacing
High canopy        (10 species)
Medium/High tree   (2 species)
Medium tree        (8 species)
Low/medium tree    (8 species)
Low tree           (1 species)
Shrub layer        (31 species)
Climber/liana      (6 species)
Tall herb          (9 species)
Tall herb geophyte (2 species)
Herb geophyte      (3 species)
Herb               (13 species)
Groundcover        (4 species)
... (wetland / aquatic strata)   ← placed last
```

### XGBoost Scoring
Instead of computing exact calories for every candidate plan:
- Extract species-count feature vector (one entry per species)
- Append 4 summary features (placement count, unique species, grid dims)
- Run `XGBRegressor.predict()` — sub-millisecond per plan
- Enables beam search across 50+ candidates in seconds

---

## Key Hyperparameters

| Parameter              | Value    | Notes                                 |
|------------------------|----------|---------------------------------------|
| Cell size              | 50 cm    | Grid resolution                       |
| Field size (default)   | 100 m²   | Configurable in `end_to_end.py`       |
| Syntropic min spacing  | 1.0 m    | Global safety margin                  |
| Max candidates         | 100      | Rejection sampling limit per species  |
| Max viable             | 20       | Positions kept per species call       |
| Beam search candidates | 50       | Plans evaluated per optimisation run  |
| XGBoost trees          | 400      | `n_estimators`                        |
| XGBoost depth          | 4        | `max_depth`                           |
| Learning rate          | 0.05     | `learning_rate`                       |

---

## Customisation

### Change Field Size
```python
# end_to_end.py → main()
optimizer = AgroforestryOptimizer(
    model_path="models/calorie_scoring_model.json",
    species_df=validator.df,
    field_width_m=200,   # ← change here
    field_height_m=200,
)
```

### Generate More Training Data
```python
# train.py → main()
main(n_train=500, n_val=100)
```

### Adjust Species Per Stratum
```python
# end_to_end.py → main()
result = optimizer.optimize_with_beam_search(
    n_candidates=50,
    target_species_per_strata=5,
)
```

---

## Performance Benchmarks

| Operation                      | Typical Time  |
|--------------------------------|---------------|
| Data loading                   | < 0.5 s       |
| Single plan generation         | 1–2 s         |
| XGBoost inference (per plan)   | < 1 ms        |
| 50-candidate beam search       | 1–2 min       |
| Training (100 samples)         | 2–5 min       |
| Model file size                | < 5 MB        |
| Memory usage                   | 200–500 MB    |

---

## Validation

Constraint violations checked post-optimisation:
```python
for each pair (p1, p2) in placements:
    distance = euclidean(p1.center, p2.center)
    required = max(p1.spacing_m, p2.spacing_m, syntropic_min_spacing_m)
    assert distance >= required
```

**Result:** Zero violations guaranteed (sampler enforces at placement time).

---

## Troubleshooting

**`Model not found` error**
→ Run `python train.py` first.

**`KeyError: 'Strata'`**
→ Ensure `data/Fixed_dataset_corrected.csv` is present (not the raw
  planning CSV). The fixed file has the pre-parsed `Strata` column.

**`KeyError: 'calories_min'` or `'spacing_m'`**
→ Same as above — use the fixed CSV, or call `validator.load()` which
  will reconstruct these columns automatically via `_ensure_derived_columns()`.

**High prediction error (MAPE > 20%)**
→ Increase `n_train` to 500+; tune `max_depth` and `n_estimators`.

**Spacing violations reported**
→ Increase `syntropic_min_spacing_m` in `ConstraintSampler.__init__()`
  or reduce `target_species_per_strata`.

---

## Future Enhancements

1. **Improved Scoring:** Train on 500+ plans; feature engineering
   (strata diversity index, canopy cover estimate)
2. **Proposal Network:** Learned placement policy to reduce rejection rate
3. **Multi-field Coordination:** Optimise adjacent fields simultaneously
4. **Temporal Dynamics:** Model canopy closure and shade effects over years
5. **Economic Model:** Weight placements by market price and labour cost
6. **Interactive UI:** Streamlit dashboard for real-time plan editing

---


## License

Open-source for research and educational use.