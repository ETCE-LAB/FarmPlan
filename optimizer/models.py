import json
import logging
from pathlib import Path

import numpy as np
import xgboost as xgb

logger = logging.getLogger(__name__)

SUMMARY_FEATURE_NAMES = (
    "placement_count",
    "unique_species_count",
    "grid_width",
    "grid_height",
)

DEFAULT_XGB_PARAMS = {
    "objective": "reg:squarederror",
    "n_estimators": 400,
    "learning_rate": 0.05,
    "max_depth": 4,
    "subsample": 0.9,
    "colsample_bytree": 0.9,
    "reg_lambda": 1.0,
    "min_child_weight": 1.0,
    "random_state": 42,
    "tree_method": "hist",
    "eval_metric": "rmse",
}


def sampler_to_features(
    sampler, species_list: list, include_summary: bool = True
) -> np.ndarray:
    """Convert a sampler state into a compact feature vector."""
    species_to_idx = {sid: i for i, sid in enumerate(species_list)}
    counts = np.zeros(len(species_list), dtype=np.float32)
    species_seen: set = set()

    for placement in getattr(sampler, "placements", []):
        idx = species_to_idx.get(placement.species_id)
        if idx is not None:
            counts[idx] += 1.0
            species_seen.add(placement.species_id)

    if not include_summary:
        return counts

    summary = np.array(
        [
            float(len(getattr(sampler, "placements", []))),
            float(len(species_seen)),
            float(getattr(sampler, "grid_width", 0)),
            float(getattr(sampler, "grid_height", 0)),
        ],
        dtype=np.float32,
    )
    return np.concatenate([counts, summary])


def build_species_count_vector(placements, species_list: list) -> np.ndarray:
    """Convert placements into a species-count feature vector."""
    species_to_idx = {sid: i for i, sid in enumerate(species_list)}
    features = np.zeros(len(species_list), dtype=np.float32)
    for placement in placements:
        sid = getattr(placement, "species_id", None)
        if sid in species_to_idx:
            features[species_to_idx[sid]] += 1.0
    return features


def batch_to_features(
    samplers: list, species_list: list, include_summary: bool = True
) -> np.ndarray:
    """Convert a list of samplers into a feature matrix."""
    feature_size = len(species_list) + (
        len(SUMMARY_FEATURE_NAMES) if include_summary else 0
    )
    if not samplers:
        return np.zeros((0, feature_size), dtype=np.float32)

    rows = [
        sampler_to_features(s, species_list, include_summary=include_summary)
        for s in samplers
    ]
    return np.vstack(rows).astype(np.float32, copy=False)


class CalorieScoringModel:
    """XGBoost regressor for predicting total calories from a planting plan."""

    def __init__(
        self,
        species_list: list,
        model: "xgb.XGBRegressor | None" = None,
        model_params: "dict | None" = None,
    ):
        self.species_list = list(species_list)
        self.model_params = dict(DEFAULT_XGB_PARAMS)
        if model_params:
            self.model_params.update(model_params)
        self.model = model or xgb.XGBRegressor(**self.model_params)

    # ------------------------------------------------------------------

    @property
    def feature_names(self) -> list:
        return [f"species_count::{s}" for s in self.species_list] + list(
            SUMMARY_FEATURE_NAMES
        )

    @property
    def feature_count(self) -> int:
        return len(self.feature_names)

    # ------------------------------------------------------------------

    def fit(self, train_features, train_labels, eval_set=None):
        train_features = np.asarray(train_features, dtype=np.float32)
        train_labels = np.asarray(train_labels, dtype=np.float32)

        fit_kwargs: dict = {"verbose": False}
        if eval_set is not None:
            if isinstance(eval_set, tuple) and len(eval_set) == 2:
                ef, el = eval_set
                eval_set = [
                    (
                        np.asarray(ef, dtype=np.float32),
                        np.asarray(el, dtype=np.float32),
                    )
                ]
            else:
                eval_set = [
                    (
                        np.asarray(f, dtype=np.float32),
                        np.asarray(l, dtype=np.float32),
                    )
                    for f, l in eval_set
                ]
            fit_kwargs["eval_set"] = eval_set

        self.model.fit(train_features, train_labels, **fit_kwargs)
        return self

    def predict(self, features) -> np.ndarray:
        features = np.asarray(features, dtype=np.float32)
        if features.ndim == 1:
            features = features.reshape(1, -1)
        return np.asarray(self.model.predict(features), dtype=np.float32)

    def predict_sampler(self, sampler) -> float:
        features = sampler_to_features(sampler, self.species_list)
        return float(self.predict(features)[0])

    # ------------------------------------------------------------------

    def save(self, model_path: str, metadata_path: "str | None" = None):
        model_path = Path(model_path)
        model_path.parent.mkdir(parents=True, exist_ok=True)
        self.model.save_model(str(model_path))

        metadata_path = (
            Path(metadata_path)
            if metadata_path is not None
            else model_path.with_suffix(".meta.json")
        )
        metadata = {
            "model_type": "XGBRegressor",
            "species_list": self.species_list,
            "feature_names": self.feature_names,
            # BUG FIX: get_params() returns numpy types which are not JSON-
            # serialisable in older versions of XGBoost; cast values to Python
            # native types explicitly.
            "model_params": {
                k: (int(v) if isinstance(v, (np.integer,)) else
                    float(v) if isinstance(v, (np.floating,)) else v)
                for k, v in self.model.get_params().items()
            },
        }
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        return model_path, metadata_path

    @classmethod
    def load(cls, model_path: str, metadata_path: "str | None" = None):
        model_path = Path(model_path)
        metadata_path = (
            Path(metadata_path)
            if metadata_path is not None
            else model_path.with_suffix(".meta.json")
        )

        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")
        if not metadata_path.exists():
            raise FileNotFoundError(f"Model metadata not found: {metadata_path}")

        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        species_list = metadata.get("species_list", [])
        if not species_list:
            raise ValueError(
                f"Model metadata does not contain species_list: {metadata_path}"
            )

        model = xgb.XGBRegressor()
        model.load_model(str(model_path))

        return cls(
            species_list=species_list,
            model=model,
            model_params=metadata.get("model_params"),
        )


def evaluate_predictions(predictions, actuals) -> dict:
    predictions = np.asarray(predictions, dtype=np.float64)
    actuals = np.asarray(actuals, dtype=np.float64)

    mae = float(np.mean(np.abs(predictions - actuals)))
    rmse = float(np.sqrt(np.mean((predictions - actuals) ** 2)))
    mape = (
        float(np.mean(np.abs((predictions - actuals) / (actuals + 1e-6))) * 100)
        if np.any(actuals)
        else 0.0
    )

    return {
        "mae": mae,
        "rmse": rmse,
        "mape": mape,
        "predictions": predictions,
        "actuals": actuals,
    }


if __name__ == "__main__":
    from data_loader import SpeciesDataValidator
    from strata_optimizer import StrataOptimizer

    validator = SpeciesDataValidator()
    validator.load().validate()

    all_species = sorted(
        validator.df[validator.df["calories_min"].notna()]["ID"].unique().tolist()
    )
    optimizer = StrataOptimizer(validator.df, field_width_m=50, field_height_m=50)

    samplers, labels = [], []
    for _ in range(8):
        sampler, plan = optimizer.generate_random_plan(target_species_per_strata=2)
        samplers.append(sampler)
        labels.append(plan["total_calories"])

    features = batch_to_features(samplers, all_species)
    model = CalorieScoringModel(
        all_species, model_params={"n_estimators": 50, "random_state": 42}
    )
    model.fit(features[:6], labels[:6], eval_set=(features[6:], labels[6:]))

    predictions = model.predict(features)
    metrics = evaluate_predictions(predictions, labels)
    print(f"Features: {features.shape}")
    print(f"MAE: {metrics['mae']:,.0f} kcal")
    print(f"RMSE: {metrics['rmse']:,.0f} kcal")