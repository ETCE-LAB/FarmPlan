"""
train.py  —  Fine-tuned for the 0.24 ha field (Step 1)
=======================================================
Trains the XGBoost calorie scorer on plans generated from the
60 m × 40 m polygon-masked field instead of the old 100 × 100 m demo field.

Run once before end_to_end.py:
    python train.py
Outputs: models/calorie_scoring_model.json
         models/calorie_scoring_model.meta.json
         models/metrics.json
"""

import json
import logging
from pathlib import Path

import numpy as np
from tqdm import tqdm

from constraint_sampler import ConstraintSampler
from data_loader import SpeciesDataValidator
from models import CalorieScoringModel, batch_to_features, evaluate_predictions
from strata_optimizer import StrataOptimizer

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# Field config  — must match end_to_end.py
# ---------------------------------------------------------------------------

FIELD_WIDTH_M  = 60.0
FIELD_HEIGHT_M = 40.0

FIELD_POLYGON_M: list[tuple[float, float]] = [
    (0,  15),
    (10,  0),
    (58,  8),
    (60, 32),
    (45, 40),
    (5,  38),
    (0,  15),
]


# ---------------------------------------------------------------------------
# Polygon-aware plan generator
# ---------------------------------------------------------------------------

class _PolygonStrataOptimizer(StrataOptimizer):
    """StrataOptimizer that injects polygon_m into every ConstraintSampler."""

    def __init__(self, species_df, field_width_m, field_height_m, polygon_m):
        super().__init__(species_df, field_width_m, field_height_m)
        self._polygon_m = polygon_m

    def generate_random_plan(self, target_species_per_strata=3, max_placement_attempts=100):
        sampler = ConstraintSampler(
            self.field_width_m,
            self.field_height_m,
            polygon_m=self._polygon_m,
        )
        plan = {"placed_species": [], "placements": []}

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
                            "species_id":        sid,
                            "x":                 placement.grid_x,
                            "y":                 placement.grid_y,
                            "calories_per_plant": float(row["calories_min"]),
                        })

        plan["total_calories"]   = self.compute_plan_calories(sampler, plan)
        plan["total_cells_used"] = len(sampler.placements)
        return sampler, plan


# ---------------------------------------------------------------------------
# Training pipeline
# ---------------------------------------------------------------------------

class TrainingDataGenerator:
    def __init__(self, optimizer, species_list):
        self.optimizer    = optimizer
        self.species_list = species_list

    def generate_batch(self, n_samples, target_species_per_strata=3):
        samplers, labels = [], []
        for _ in tqdm(range(n_samples), desc="Generating plans"):
            sampler, plan = self.optimizer.generate_random_plan(target_species_per_strata)
            samplers.append(sampler)
            labels.append(plan["total_calories"])
        features = batch_to_features(samplers, self.species_list)
        return features, np.asarray(labels, dtype=np.float32)


def main(n_train: int = 500, n_val: int = 100):
    logger.info("Loading species data …")
    validator = SpeciesDataValidator()
    validator.load().validate()

    all_species = sorted(
        validator.df[validator.df["calories_min"].notna()]["ID"].unique().tolist()
    )
    logger.info(f"  {len(all_species)} species with calorie data")

    logger.info(f"Building polygon-aware optimizer  ({FIELD_WIDTH_M:.0f} × {FIELD_HEIGHT_M:.0f} m) …")
    optimizer = _PolygonStrataOptimizer(
        validator.df, FIELD_WIDTH_M, FIELD_HEIGHT_M, FIELD_POLYGON_M
    )
    gen = TrainingDataGenerator(optimizer, all_species)

    logger.info(f"Generating {n_train} training plans …")
    train_X, train_y = gen.generate_batch(n_train, target_species_per_strata=2)

    logger.info(f"Generating {n_val} validation plans …")
    val_X, val_y = gen.generate_batch(n_val, target_species_per_strata=2)

    logger.info(
        f"Calorie range  train: {train_y.min():,.0f} – {train_y.max():,.0f} kcal  |  "
        f"val: {val_y.min():,.0f} – {val_y.max():,.0f} kcal"
    )

    logger.info("Training XGBoost scorer …")
    model = CalorieScoringModel(species_list=all_species)
    model.fit(train_X, train_y, eval_set=(val_X, val_y))

    train_metrics = evaluate_predictions(model.predict(train_X), train_y)
    val_metrics   = evaluate_predictions(model.predict(val_X),   val_y)

    logger.info(
        f"Train  MAE={train_metrics['mae']:,.0f}  RMSE={train_metrics['rmse']:,.0f}  "
        f"MAPE={train_metrics['mape']:.2f}%"
    )
    logger.info(
        f"Val    MAE={val_metrics['mae']:,.0f}  RMSE={val_metrics['rmse']:,.0f}  "
        f"MAPE={val_metrics['mape']:.2f}%"
    )

    models_dir = BASE_DIR / "models"
    models_dir.mkdir(exist_ok=True)
    model_path, meta_path = model.save(models_dir / "calorie_scoring_model.json")

    metrics_out = {
        "train": {k: float(v) for k, v in train_metrics.items() if k not in {"predictions", "actuals"}},
        "val":   {k: float(v) for k, v in val_metrics.items()   if k not in {"predictions", "actuals"}},
        "model_config": {
            "type":            "XGBRegressor",
            "feature_count":   int(model.feature_count),
            "n_species":       len(all_species),
            "n_train_samples": n_train,
            "n_val_samples":   n_val,
            "field_size_m":    [FIELD_WIDTH_M, FIELD_HEIGHT_M],
            "polygon_pts":     len(FIELD_POLYGON_M),
            "model_path":      str(model_path),
            "metadata_path":   str(meta_path),
        },
    }
    with open(models_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics_out, f, indent=2)

    logger.info("Saved model + metrics to models/")
    return model, all_species, metrics_out


if __name__ == "__main__":
    main(n_train=500, n_val=100)