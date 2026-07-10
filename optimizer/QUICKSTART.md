# QUICK START GUIDE

## Installation (First Time Only)

```bash
cd /c/Users/lokij/Desktop/Ostfalia/Farm\ Plan/optimizer

# Core — required
pip install xgboost pandas numpy tqdm

# Optional — for visualisation notebooks only
pip install matplotlib jupyter
```

> **No PyTorch needed.** The scoring model is XGBoost, not a CNN.
> The old `torch` / `torchvision` install step has been removed.

---

## Run in 30 Seconds

```bash
cd optimizer
python demo.py
```

**What it does:** Validates species data, tests the constraint sampler,
generates 5 random strata plans, runs a constraint check — no pre-trained
model required.

---

## Full System (~5–10 Minutes)

### Step 1: Train the XGBoost Scorer
```bash
python train.py
```
Generates 100 training + 30 validation plans from the classical sampler,
then trains the XGBoost scorer. Outputs saved to `models/`.

### Step 2: Optimise a Field Plan
```bash
python end_to_end.py
```
Runs a 50-candidate beam search, selects the best plan, validates all
spacing constraints. Outputs saved to `output/`.

### Step 3: Visualise Results
```bash
jupyter notebook notebooks/analysis.ipynb
```

---

## What You Get

### Files Generated

| File | Contents |
|------|----------|
| `models/calorie_scoring_model.json` | Trained XGBoost model |
| `models/calorie_scoring_model.meta.json` | Species list & feature names |
| `models/metrics.json` | Train / val accuracy metrics |
| `output/grid_visualization.npy` | 200 × 200 occupancy grid |
| `output/plan_result.json` | Optimal plan metadata |
| `output/demo_results.json` | Demo phase-by-phase summary |

### Plans Include
- ✓ 40–100 plant placements across up to 17 strata
- ✓ 20–40 unique species per plan
- ✓ 500 K – 2.4 M kcal per 100 m × 100 m field
- ✓ All spacing constraints satisfied (zero violations)

---

## File Guide

| File | Purpose |
|------|---------|
| `data_loader.py` | Load & validate `Fixed_dataset_corrected.csv` |
| `constraint_sampler.py` | 2D grid + rejection sampling |
| `strata_optimizer.py` | Hierarchical placement (emergent → groundcover) |
| `models.py` | `CalorieScoringModel` (XGBoost wrapper) + feature utils |
| `train.py` | Full training pipeline |
| `end_to_end.py` | Beam search optimisation + plan export |
| `demo.py` | Quick 2-minute demo of all components |

---

## Expected Demo Output

```
SYNTROPIC AGROFORESTRY XGBOOST OPTIMIZER - DEMO
======================================================================

[PHASE 1] Validating species data...
  [OK] Loaded 110 species
  [OK] Trees: 38, Shrubs: 31, Perennials: 41
  [OK] Calorie data: 88 / 110
  [OK] Spacing data: 110 / 110

[PHASE 2] Testing constraint sampler...
  [OK] Placed Walnut (T01) at (12, 34) - spacing: 10.0m
  [OK] Placed Heartnut (T02) at (19, 54) - spacing: 8.0m
  [OK] Placed Sweet chestnut (T03) at (88, 72) - spacing: 8.0m
  [OK] Total placements: 3
  [OK] Estimated calories: 520,000 kcal

[PHASE 3] Running hierarchical strata optimization...
  [OK] Generated 5 random plans
  [OK] Top plan: 1,492,768 kcal
       Placements: 63
       Unique species: 28

[PHASE 4-5] Summary & Validation
  [OK] Spacing constraint validation: 66 placements
  [OK] Violations found: 0
  [OK] Status: PASS [OK]

  [OK] Demo outputs saved to output/demo_results.json
======================================================================
```

---

## Architecture Overview

```
XGBOOST OPTIMIZER PIPELINE
├─ Phase 1: Data Validation
│  └─ Load Fixed_dataset_corrected.csv
│     Pre-parsed: Strata, calories_min, spacing_m (110 species, 17 strata)
├─ Phase 2: Constraint Sampler
│  └─ 2D grid + rejection sampling (50 cm cells, 1.0 m syntropic minimum)
├─ Phase 3: Strata Orchestration
│  └─ Hierarchical placement (emergent canopy → aquatic rhizome)
├─ Phase 4: XGBoost Scorer
│  ├─ Species-count + summary features → XGBRegressor → scalar kcal
│  └─ < 1 ms inference; model + metadata persisted as JSON
└─ Phase 5: End-to-End
   └─ 50-candidate beam search → best plan → constraint validation → export
```

---

## Customisation

### Change Field Size
Edit `end_to_end.py → main()`:
```python
optimizer = AgroforestryOptimizer(
    model_path="models/calorie_scoring_model.json",
    metadata_path="models/calorie_scoring_model.meta.json",
    species_df=validator.df,
    field_width_m=200,    # ← change here
    field_height_m=200,
)
```

### Generate More Training Data
Edit `train.py → main()` call:
```python
main(n_train=500, n_val=100)   # instead of 100 / 30
```

### Adjust Species Per Stratum
Edit `end_to_end.py → main()`:
```python
result = optimizer.optimize_with_beam_search(
    n_candidates=50,
    target_species_per_strata=5,   # ← change here
)
```

---

## Troubleshooting

**`Model not found` error**
→ Run `python train.py` first to generate the model files.

**`KeyError: 'Strata'` or `'calories_min'`**
→ Make sure `data/Fixed_dataset_corrected.csv` is present.
  Do **not** use the raw `20260320_Neorx-treeline-planning.csv` directly.

**High prediction error (MAPE > 20%)**
→ Increase `n_train` to 500+ in `train.py` and retrain.

**Spacing violations reported**
→ Increase `syntropic_min_spacing_m` in `ConstraintSampler` init,
  or reduce `target_species_per_strata` in the optimiser call.

---

## Next Steps

1. **Improve Scorer Accuracy**
   - Train on 500+ plans (`n_train=500`)
   - Tune `max_depth`, `n_estimators`, `subsample`

2. **Add More Species**
   - Extend `Fixed_dataset_corrected.csv` with new rows
   - Re-run `demo.py` to validate; re-run `train.py` to retrain

3. **Multi-field Optimisation**
   - Coordinate placement across adjacent fields
   - Model hedgerow effects between plots

4. **Interactive UI**
   - Build a Streamlit dashboard for real-time plan editing
   - Export plans to GIS-compatible formats

---

## Support

- **Detailed phase notes:** `IMPLEMENTATION_SUMMARY.md`
- **Full API docs:** `README.md`
- **Visual analysis:** `notebooks/analysis.ipynb`
- **Inline comments:** every module has inline documentation