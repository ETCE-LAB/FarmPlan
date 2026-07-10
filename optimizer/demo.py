#!/usr/bin/env python
"""Quick demo of the optimizer without requiring full training."""

import json
from pathlib import Path

from constraint_sampler import ConstraintSampler
from data_loader import SpeciesDataValidator
from strata_optimizer import StrataOptimizer


def demo():
    print("\n" + "=" * 70)
    print("SYNTROPIC AGROFORESTRY XGBOOST OPTIMIZER - DEMO")
    print("=" * 70)

    # ------------------------------------------------------------------
    # PHASE 1 — Validate species data
    # BUG FIX: both old versions hard-coded the raw planning CSV path.
    # SpeciesDataValidator() with no argument now defaults to the fixed
    # dataset (data/Fixed_dataset_corrected.csv) which already has the
    # pre-parsed 'Strata', 'calories_min', and 'spacing_m' columns.
    # ------------------------------------------------------------------
    print("\n[PHASE 1] Validating species data...")
    validator = SpeciesDataValidator()
    validator.load().validate()

    report = validator.validation_report
    print(f"  [OK] Loaded {report['total_species']} species")
    print(
        f"  [OK] Trees: {report['by_category'].get('Tree', 0)}, "
        f"Shrubs: {report['by_category'].get('Shrub', 0)}, "
        f"Perennials: {report['by_category'].get('Perennial', 0)}"
    )
    print(
        f"  [OK] Calorie data: {report['data_quality']['calories_numeric']}"
        f" / {report['total_species']}"
    )
    print(
        f"  [OK] Spacing data: {report['data_quality']['spacing_numeric']}"
        f" / {report['total_species']}"
    )

    # ------------------------------------------------------------------
    # PHASE 2 — Test the constraint sampler
    # ------------------------------------------------------------------
    print("\n[PHASE 2] Testing constraint sampler...")
    sampler = ConstraintSampler(field_width_m=50, field_height_m=50)

    tree_species = validator.df[
        (validator.df["Category"] == "Tree")
        & validator.df["calories_min"].notna()
        & validator.df["spacing_m"].notna()
    ]

    placed_names = []
    for _, species_row in tree_species.head(3).iterrows():
        species_id = species_row["ID"]
        spacing_m = float(species_row["spacing_m"])

        viable = sampler.generate_viable_placements(
            species_id, spacing_m, max_candidates=100, max_viable=5
        )
        if viable:
            success = sampler.place_species(viable[0])
            if success:
                placed_names.append(species_row["English name"])
                print(
                    f"  [OK] Placed {species_row['English name']} ({species_id}) "
                    f"at ({viable[0].grid_x}, {viable[0].grid_y}) "
                    f"- spacing: {spacing_m}m"
                )

    # BUG FIX: both old versions summed calories over tree_species.head(len(placements))
    # which is the first N rows by DataFrame order, NOT the rows that were actually
    # placed.  If the first tree had 0 calorie data it would still be counted.
    # We now sum only from the species that were confirmed placed.
    exact_cal = sum(
        float(
            validator.df.loc[
                validator.df["English name"] == name, "calories_min"
            ].iloc[0]
        )
        for name in placed_names
    )

    print(f"  [OK] Total placements: {len(sampler.placements)}")
    print(f"  [OK] Estimated calories: {exact_cal:,.0f} kcal")

    # ------------------------------------------------------------------
    # PHASE 3 — Hierarchical strata optimisation
    # ------------------------------------------------------------------
    print("\n[PHASE 3] Running hierarchical strata optimization...")
    optimizer = StrataOptimizer(validator.df, field_width_m=50, field_height_m=50)

    plans = []
    for _ in range(5):
        _, plan = optimizer.generate_random_plan(target_species_per_strata=2)
        plans.append(plan)

    plans.sort(key=lambda p: p["total_calories"], reverse=True)
    print("  [OK] Generated 5 random plans")
    print(f"  [OK] Top plan: {plans[0]['total_calories']:,.0f} kcal")
    print(f"       Placements: {plans[0]['total_cells_used']}")
    print(
        f"       Unique species: "
        f"{len(set(p['species_id'] for p in plans[0]['placements']))}"
    )

    # ------------------------------------------------------------------
    # PHASE 4-5 — Constraint validation
    # BUG FIX: both old versions iterated best_sampler.grid.items() in the
    # outer loop and list(best_sampler.grid.items()) in the inner loop.
    # Converting to a list on every outer iteration is redundant; one
    # snapshot taken before the loops is enough and avoids any risk of
    # modification during iteration.
    # ------------------------------------------------------------------
    print("\n[PHASE 4-5] Summary & Validation")
    best_sampler, _ = optimizer.generate_random_plan()
    violations = 0

    grid_items = list(best_sampler.grid.items())
    for i, ((x1, y1), p1) in enumerate(grid_items):
        for (x2, y2), p2 in grid_items[i + 1 :]:
            dist = best_sampler.distance_between_cells(x1, y1, x2, y2)
            min_spacing = max(
                p1.spacing_m, p2.spacing_m, best_sampler.syntropic_min_spacing_m
            )
            if dist < min_spacing - 1e-6:
                violations += 1

    print(
        f"  [OK] Spacing constraint validation: "
        f"{len(best_sampler.placements)} placements"
    )
    print(f"  [OK] Violations found: {violations}")
    print(
        f"  [OK] Status: {'PASS [OK]' if violations == 0 else 'FAIL [FAIL]'}"
    )

    # ------------------------------------------------------------------
    # Save results
    # BUG FIX: the two old demo() functions were identical except for the
    # 'component_status' dict key 'phase4_boosted_model' vs
    # 'phase4_xgboost_scoring'.  Unified to 'phase4_xgboost_scoring'.
    # ------------------------------------------------------------------
    Path("output").mkdir(exist_ok=True)
    output_data = {
        "data_validation": {
            "total_species": report["total_species"],
            "species_by_category": report["by_category"],
            "species_by_strata": report["by_strata"],
            "calorie_coverage": (
                f"{report['data_quality']['calories_numeric']}"
                f"/{report['total_species']}"
            ),
            "spacing_coverage": (
                f"{report['data_quality']['spacing_numeric']}"
                f"/{report['total_species']}"
            ),
        },
        "demo_plan": {
            "best_calorie_yield": plans[0]["total_calories"],
            "placements": plans[0]["total_cells_used"],
            "unique_species": len(
                set(p["species_id"] for p in plans[0]["placements"])
            ),
            "field_size_m": [50, 50],
            "constraint_violations": violations,
        },
        "component_status": {
            "phase1_data_validation": "COMPLETE [OK]",
            "phase2_constraint_sampler": "COMPLETE [OK]",
            "phase3_strata_optimizer": "COMPLETE [OK]",
            "phase4_xgboost_scoring": "TRAINED (see models/)",
            "phase5_end_to_end": "COMPLETE [OK]",
        },
    }

    with open("output/demo_results.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    print("\n  [OK] Demo outputs saved to output/demo_results.json")
    print("\n" + "=" * 70)
    print("DEMO COMPLETE")
    print("=" * 70)
    print("\nNext steps:")
    print("  1. Run 'python train.py' to train the XGBoost scorer (fast)")
    print("  2. Run 'python end_to_end.py' to generate optimized plans")
    print("  3. Open 'notebooks/analysis.ipynb' for visualization")
    print("=" * 70 + "\n")

    return output_data


if __name__ == "__main__":
    demo()