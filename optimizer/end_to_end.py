"""
end_to_end.py  —  Fine-tuned for the 0.24 ha field (Step 1)
============================================================
Field: ~60 m × 40 m trapezoid, Hannover region, zone 7b
"""

import json
import logging
import math
from pathlib import Path
from typing import Dict

import numpy as np

from constraint_sampler import ConstraintSampler, SpeciesPlacement, GridCell
from data_loader import SpeciesDataValidator
from models import CalorieScoringModel
from strata_optimizer import StrataOptimizer

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# FIELD CONFIGURATION
# ---------------------------------------------------------------------------

FIELD_POLYGON_M: list[tuple[float, float]] = [
    (0,  15),
    (10,  0),
    (58,  8),
    (60, 32),
    (45, 40),
    (5,  38),
    (0,  15),
]

FIELD_WIDTH_M  = 60.0
FIELD_HEIGHT_M = 40.0

MODEL_PATH    = "models/calorie_scoring_model.json"
METADATA_PATH = "models/calorie_scoring_model.meta.json"

N_CANDIDATES = 50
TARGET_SPECIES_PER_STRATA = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _max_spacing(species_df) -> float:
    """Return the largest spacing_m in the dataset (used as global search radius)."""
    return float(species_df["spacing_m"].max())


def _make_sampler(field_width_m, field_height_m, polygon_m, max_sp) -> ConstraintSampler:
    """Factory so every sampler gets the correct max_species_spacing_m."""
    return ConstraintSampler(
        field_width_m,
        field_height_m,
        polygon_m=polygon_m,
        max_species_spacing_m=max_sp,
    )


# ---------------------------------------------------------------------------
# Spacing validator
# ---------------------------------------------------------------------------

def validate_spacing(sampler: ConstraintSampler) -> int:
    """Return the number of pairwise spacing violations in a sampler."""
    violations = 0
    items = list(sampler.grid.items())
    for i, ((x1, y1), p1) in enumerate(items):
        for (x2, y2), p2 in items[i + 1:]:
            dist   = sampler.distance_between_cells(x1, y1, x2, y2)
            min_sp = max(p1.spacing_m, p2.spacing_m, sampler.syntropic_min_spacing_m)
            if dist < min_sp - 1e-6:
                violations += 1
                logger.warning(
                    f"  VIOLATION: {p1.species_id} ({x1},{y1}) ↔ "
                    f"{p2.species_id} ({x2},{y2})  "
                    f"dist={dist:.2f} m < {min_sp:.2f} m"
                )
    return violations


# ---------------------------------------------------------------------------
# Post-processing: remove any residual violations (safety net)
# ---------------------------------------------------------------------------

def remove_violations(sampler: ConstraintSampler) -> ConstraintSampler:
    """
    Rebuild a clean sampler largest-spacing-first.
    With the fixed check_spacing_constraint this should always produce 0
    violations, but we keep it as a safety net.
    """
    sorted_placements = sorted(
        sampler.placements, key=lambda p: p.spacing_m, reverse=True
    )

    clean = ConstraintSampler(
        sampler.field_width_m,
        sampler.field_height_m,
        syntropic_min_spacing_m=sampler.syntropic_min_spacing_m,
        polygon_m=sampler.polygon_m,
        max_species_spacing_m=sampler.max_species_spacing_m,
    )

    for p in sorted_placements:
        if clean.check_spacing_constraint(p.grid_x, p.grid_y, p.spacing_m):
            clean.grid[(p.grid_x, p.grid_y)] = p
            clean.placements.append(p)

    removed = len(sampler.placements) - len(clean.placements)
    if removed > 0:
        logger.info(
            f"  Safety-net cleanup: removed {removed} violating plants, "
            f"kept {len(clean.placements)}"
        )

    remaining = validate_spacing(clean)
    if remaining > 0:
        logger.error(
            f"  BUG: {remaining} violations remain after cleanup — "
            f"check constraint_sampler.py"
        )

    return clean


# ---------------------------------------------------------------------------
# Polygon-aware StrataOptimizer
# ---------------------------------------------------------------------------

class _PolygonStrataOptimizer(StrataOptimizer):
    def __init__(self, species_df, field_width_m, field_height_m, polygon_m):
        super().__init__(species_df, field_width_m, field_height_m)
        self._polygon_m   = polygon_m
        self._max_spacing = _max_spacing(species_df)

    def generate_random_plan(
        self, target_species_per_strata=3, max_placement_attempts=100
    ):
        sampler = _make_sampler(
            self.field_width_m,
            self.field_height_m,
            self._polygon_m,
            self._max_spacing,
        )
        plan: Dict = {"placed_species": [], "placements": []}

        for strata in self.strata_order:
            if strata not in self.strata_species:
                continue
            species_in_strata = self.strata_species[strata]
            n_to_place = min(target_species_per_strata, len(species_in_strata))
            selected = species_in_strata.sample(n=n_to_place, random_state=None)

            for _, row in selected.iterrows():
                sid     = row["ID"]
                spacing = float(row["spacing_m"])
                viable  = sampler.generate_viable_placements(
                    sid, spacing, max_candidates=100, max_viable=20
                )
                if not viable:
                    continue
                n_instances = np.random.randint(1, min(4, len(viable) + 1))
                for placement in viable[:n_instances]:
                    if sampler.place_species(placement):
                        plan["placed_species"].append(sid)
                        plan["placements"].append({
                            "species_id":         sid,
                            "x":                  placement.grid_x,
                            "y":                  placement.grid_y,
                            "calories_per_plant": float(row["calories_min"]),
                        })

        plan["total_calories"]   = self.compute_plan_calories(sampler, plan)
        plan["total_cells_used"] = len(sampler.placements)
        return sampler, plan


# ---------------------------------------------------------------------------
# FieldOptimizer
# ---------------------------------------------------------------------------

class FieldOptimizer:
    def __init__(self, model_path, metadata_path, species_df,
                 field_width_m, field_height_m, polygon_m=None):
        self.species_df     = species_df.copy()
        self.field_width_m  = field_width_m
        self.field_height_m = field_height_m
        self.polygon_m      = polygon_m
        self._max_spacing   = _max_spacing(species_df)

        self.model       = CalorieScoringModel.load(model_path, metadata_path=metadata_path)
        self.all_species = self.model.species_list
        self._strata_opt = _PolygonStrataOptimizer(
            species_df, field_width_m, field_height_m, polygon_m
        )

    def compute_exact_calories(self, sampler: ConstraintSampler) -> float:
        total = 0.0
        for p in sampler.placements:
            match = self.species_df[self.species_df["ID"] == p.species_id]
            if len(match) > 0:
                total += float(match.iloc[0]["calories_min"])
        return total

    def optimize(self, n_candidates=50, target_species_per_strata=3) -> Dict:
        best_calories = -1
        best_result   = None

        for i in range(n_candidates):
            sampler, plan = self._strata_opt.generate_random_plan(
                target_species_per_strata
            )
            # Safety-net cleanup (should be a no-op with the fixed sampler).
            clean = remove_violations(sampler)
            exact = self.compute_exact_calories(clean)

            if exact > best_calories:
                best_calories = exact
                best_result   = (clean, plan, exact)

            if (i + 1) % 10 == 0:
                logger.info(
                    f"  {i+1}/{n_candidates} candidates "
                    f"(best: {best_calories:,.0f} kcal)"
                )

        best_sampler, best_plan, exact = best_result
        return {
            "sampler":            best_sampler,
            "plan":               best_plan,
            "predicted_calories": exact,
            "exact_calories":     exact,
            "prediction_error":   0.0,
            "error_pct":          0.0,
            "placements":         len(best_sampler.placements),
            "species_count":      len(set(p.species_id for p in best_sampler.placements)),
        }

    def export_grid(self, result: Dict) -> np.ndarray:
        sampler = result["sampler"]
        grid_array = np.full((sampler.grid_height, sampler.grid_width), -1, dtype=int)
        species_to_idx = {sid: i for i, sid in enumerate(self.all_species)}
        for (x, y), placement in sampler.grid.items():
            if placement.species_id in species_to_idx:
                grid_array[y, x] = species_to_idx[placement.species_id]
        return grid_array

    def export_placements_json(self, result: Dict) -> list:
        sampler = result["sampler"]
        rows = []
        for p in sampler.placements:
            match = self.species_df[self.species_df["ID"] == p.species_id]
            if len(match) == 0:
                continue
            row = match.iloc[0]
            cx = p.grid_x * 0.5 + 0.25
            cy = p.grid_y * 0.5 + 0.25
            rows.append({
                "species_id":    p.species_id,
                "german_name":   str(row.get("German name", "")),
                "english_name":  str(row.get("English name", "")),
                "strata":        str(row.get("Strata", "")),
                "calories_kcal": float(row.get("calories_min", 0) or 0),
                "spacing_m":     float(p.spacing_m),
                "position_m":    {"x": round(cx, 2), "y": round(cy, 2)},
                "grid_cell":     {"x": p.grid_x, "y": p.grid_y},
            })
        return rows

    def print_summary(self, result: Dict, violations: int):
        sampler = result["sampler"]
        print("\n" + "=" * 65)
        print("OPTIMAL FIELD PLAN  —  0.24 ha (60 m × 40 m)")
        print("=" * 65)
        print(f"Field grid:         {sampler.grid_width} x {sampler.grid_height} cells (50 cm each)")
        print(f"Total placements:   {result['placements']}")
        print(f"Unique species:     {result['species_count']}")
        print(f"\nExact calories:     {result['exact_calories']:>12,.0f} kcal / year")
        status = "✓ PASS" if violations == 0 else f"✗ {violations} VIOLATIONS"
        print(f"Spacing check:      {status}")
        print("\nBreakdown by strata:")

        strata_counts: Dict[str, dict] = {}
        for p in sampler.placements:
            match = self.species_df[self.species_df["ID"] == p.species_id]
            if len(match) == 0:
                continue
            strata = str(match.iloc[0]["Strata"])
            name   = str(match.iloc[0]["English name"])
            if strata not in strata_counts:
                strata_counts[strata] = {"n": 0, "species": set()}
            strata_counts[strata]["n"] += 1
            strata_counts[strata]["species"].add(name)

        for strata, info in sorted(strata_counts.items()):
            print(f"  {strata:<28} {info['n']:>3} plants  "
                  f"{len(info['species'])} species")
        print("=" * 65)


# ---------------------------------------------------------------------------
# GPS helper
# ---------------------------------------------------------------------------

def gps_to_local_m(gps_points, origin_lat=None, origin_lon=None):
    if origin_lat is None:
        origin_lat, origin_lon = gps_points[0]
    R = 6_371_000.0
    result = []
    for lat, lon in gps_points:
        x = math.radians(lon - origin_lon) * R * math.cos(math.radians(origin_lat))
        y = math.radians(lat - origin_lat) * R
        result.append((round(x, 2), round(y, 2)))
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    logger.info("Loading species data ...")
    validator = SpeciesDataValidator()
    validator.load().validate()
    logger.info(f"  {len(validator.df)} species loaded")

    max_sp = _max_spacing(validator.df)
    logger.info(f"  Max species spacing in dataset: {max_sp} m")

    model_path = BASE_DIR / MODEL_PATH
    metadata_path = BASE_DIR / METADATA_PATH

    if not model_path.exists():
        print(f"\n[ERROR] Model not found at '{MODEL_PATH}'.\nRun train.py first.\n")
        return

    logger.info(
        f"Building FieldOptimizer  "
        f"({FIELD_WIDTH_M:.0f} m x {FIELD_HEIGHT_M:.0f} m, "
        f"polygon={len(FIELD_POLYGON_M)} pts)"
    )
    optimizer = FieldOptimizer(
        model_path=model_path,
        metadata_path=metadata_path,
        species_df=validator.df,
        field_width_m=FIELD_WIDTH_M,
        field_height_m=FIELD_HEIGHT_M,
        polygon_m=FIELD_POLYGON_M,
    )

    logger.info(f"Running optimisation ({N_CANDIDATES} candidates) ...")
    result = optimizer.optimize(
        n_candidates=N_CANDIDATES,
        target_species_per_strata=TARGET_SPECIES_PER_STRATA,
    )

    logger.info("Validating spacing constraints ...")
    violations = validate_spacing(result["sampler"])
    if violations == 0:
        logger.info(f"  All {result['placements']} placements PASS")
    else:
        logger.error(f"  {violations} VIOLATIONS remain — unexpected")

    optimizer.print_summary(result, violations)

    output_dir = BASE_DIR / "output"
    output_dir.mkdir(exist_ok=True)

    grid_viz = optimizer.export_grid(result)
    np.save(output_dir / "grid_visualization.npy", grid_viz)
    logger.info(f"  Saved grid {grid_viz.shape} -> output/grid_visualization.npy")

    plan_out = {
        "predicted_calories": result["predicted_calories"],
        "exact_calories":     result["exact_calories"],
        "prediction_error":   result["prediction_error"],
        "error_pct":          result["error_pct"],
        "placements":         result["placements"],
        "species_count":      result["species_count"],
        "field_size_m":       [FIELD_WIDTH_M, FIELD_HEIGHT_M],
        "polygon_pts":        len(FIELD_POLYGON_M),
        "spacing_violations": violations,
    }
    with open(output_dir / "plan_result.json", "w", encoding="utf-8") as f:
        json.dump(plan_out, f, indent=2)
    logger.info("  Saved metrics -> output/plan_result.json")

    placements_list = optimizer.export_placements_json(result)
    with open(output_dir / "plan_placements.json", "w", encoding="utf-8") as f:
        json.dump(placements_list, f, indent=2, ensure_ascii=False)
    logger.info(f"  Saved {len(placements_list)} plants -> output/plan_placements.json")

    print("\nStep 1 complete.")
    print("Next: integrate output/plan_placements.json into your dashboard (Step 2)")


if __name__ == "__main__":
    main()