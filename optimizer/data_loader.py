import pandas as pd
import numpy as np
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SpeciesDataValidator:
    """Loads and validates species data from the fixed hot-encoded CSV."""

    # BUG FIX: was pointing at the raw planning CSV which lacks pre-parsed
    # numeric columns ('calories_min', 'spacing_m') and the flat 'Strata'
    # column.  The fixed dataset already has all of these so we just alias
    # them; no per-row regex parsing is required.
    DEFAULT_CSV = "data/Fixed_dataset.csv"

    def __init__(self, csv_path: str = None):
        csv_path = Path(csv_path or self.DEFAULT_CSV)
        if csv_path.is_absolute():
            self.csv_path = csv_path
        else:
            self.csv_path = (Path(__file__).resolve().parent / csv_path).resolve()
        self.df = None
        self.validation_report = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load(self):
        """Load CSV and perform initial cleaning."""
        if not self.csv_path.exists():
            raise FileNotFoundError(f"CSV not found: {self.csv_path}")

        self.df = pd.read_csv(self.csv_path, encoding="utf-8")
        logger.info(f"Loaded {len(self.df)} rows from {self.csv_path.name}")

        # Drop fully-empty rows and rows without an ID
        self.df = self.df.dropna(how="all")
        self.df = self.df[self.df["ID"].notna()].reset_index(drop=True)

        # BUG FIX: the fixed CSV already has 'Strata' (plain text),
        # 'calories_min' (numeric), and 'spacing_m' (numeric).
        # The old loader tried to parse these from raw range strings like
        # "120 000 – 400 000" and "10-12 m" every load — which silently
        # failed on many rows because the regex split didn't handle the
        # en-dash (–) vs hyphen (-) consistently.
        # We still call _ensure_derived_columns() as a safety net so the
        # loader works even if pointed at a file that has the raw columns.
        self._ensure_derived_columns()

        return self

    def validate(self) -> dict:
        """Validate data completeness and consistency."""
        report = {
            "total_species": len(self.df),
            "by_category": {},
            "by_strata": {},
            "data_quality": {},
            "issues": [],
        }

        for cat in self.df["Category"].dropna().unique():
            report["by_category"][cat] = int((self.df["Category"] == cat).sum())

        for strata in self.df["Strata"].dropna().unique():
            report["by_strata"][strata] = int((self.df["Strata"] == strata).sum())

        # BUG FIX: original checked 'Minimum spacing' which no longer exists
        # in the fixed CSV; use the pre-parsed 'spacing_m' column instead.
        critical_fields = ["ID", "Category", "Strata", "German name", "spacing_m"]
        for field in critical_fields:
            if field not in self.df.columns:
                report["issues"].append(f"Missing column: {field}")
                report["data_quality"][field] = 0
                continue
            missing = int(self.df[field].isna().sum())
            if missing > 0:
                report["issues"].append(f"Missing {field}: {missing} rows")
            report["data_quality"][field] = len(self.df) - missing

        report["data_quality"]["calories_numeric"] = int(self.df["calories_min"].notna().sum())
        report["data_quality"]["spacing_numeric"] = int(self.df["spacing_m"].notna().sum())

        self.validation_report = report
        return report

    def get_species_by_strata(self) -> dict:
        """Return dict mapping strata → DataFrame of valid species."""
        strata_map = {}
        for strata in self.df["Strata"].dropna().unique():
            subset = self.df[
                (self.df["Strata"] == strata)
                & self.df["calories_min"].notna()
                & self.df["spacing_m"].notna()
            ].copy()
            if len(subset) > 0:
                strata_map[strata] = subset
        return strata_map

    def print_report(self):
        if not self.validation_report:
            self.validate()
        report = self.validation_report
        print("\n" + "=" * 60)
        print("SPECIES DATA VALIDATION REPORT")
        print("=" * 60)
        print(f"\nTotal species: {report['total_species']}")
        print("\nBy Category:")
        for cat, count in report["by_category"].items():
            print(f"  {cat}: {count}")
        print("\nBy Strata:")
        for strata, count in report["by_strata"].items():
            print(f"  {strata}: {count}")
        print("\nData Quality:")
        for field, count in report["data_quality"].items():
            pct = 100 * count / report["total_species"] if report["total_species"] > 0 else 0
            print(f"  {field}: {count}/{report['total_species']} ({pct:.1f}%)")
        if report["issues"]:
            print("\nIssues:")
            for issue in report["issues"]:
                print(f"  [!] {issue}")
        print("\n" + "=" * 60)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_derived_columns(self):
        """
        Guarantee that 'Strata', 'calories_min', and 'spacing_m' exist.

        If the fixed CSV already has them (the normal case) this is a no-op.
        If the loader is pointed at the raw planning CSV (legacy fallback) we
        reconstruct them from the raw range strings.
        """
        # --- Strata ---
        if "Strata" not in self.df.columns:
            strata_cols = [c for c in self.df.columns if c.startswith("Strata_")]
            if strata_cols:
                # Reconstruct from hot-encoded columns
                def _first_active(row):
                    for c in strata_cols:
                        if row[c] == 1:
                            return c.replace("Strata_", "")
                    return None
                self.df["Strata"] = self.df.apply(_first_active, axis=1)
            else:
                logger.warning("No 'Strata' column and no 'Strata_*' columns found.")

        # --- calories_min ---
        if "calories_min" not in self.df.columns:
            if "Target_Calories_Midpoint" in self.df.columns:
                # Fixed CSV already has a numeric midpoint
                self.df["calories_min"] = pd.to_numeric(
                    self.df["Target_Calories_Midpoint"], errors="coerce"
                )
            elif "Expected annual calories (kcal/plant, mature)" in self.df.columns:
                # BUG FIX: original used str.split('-') which silently dropped
                # the en-dash (–) separator, yielding NaN for most rows.
                # Now we handle both '–' and '-' explicitly.
                self.df["calories_min"] = self.df[
                    "Expected annual calories (kcal/plant, mature)"
                ].apply(_parse_range_min)
            else:
                logger.warning("No calorie source column found.")
                self.df["calories_min"] = np.nan

        # --- spacing_m ---
        if "spacing_m" not in self.df.columns:
            if "Spacing_m_Minimum" in self.df.columns:
                self.df["spacing_m"] = pd.to_numeric(
                    self.df["Spacing_m_Minimum"], errors="coerce"
                )
            elif "Minimum spacing" in self.df.columns:
                self.df["spacing_m"] = self.df["Minimum spacing"].apply(_parse_spacing)
            else:
                logger.warning("No spacing source column found.")
                self.df["spacing_m"] = np.nan


# ------------------------------------------------------------------
# Module-level parsing helpers (used by _ensure_derived_columns)
# ------------------------------------------------------------------

def _parse_range_min(value) -> float:
    """Extract the lower bound from a range string like '120 000 – 400 000' or '0'."""
    if pd.isna(value):
        return np.nan
    s = str(value).replace(",", "").replace(" ", "")
    # Handle both en-dash and hyphen separators
    for sep in ("–", "-"):
        if sep in s:
            try:
                return float(s.split(sep)[0])
            except ValueError:
                pass
    try:
        return float(s)
    except ValueError:
        return np.nan


def _parse_spacing(value) -> float:
    """Extract numeric minimum spacing from strings like '10 m' or '8-10 m'."""
    if pd.isna(value):
        return np.nan
    s = str(value).replace("m", "").strip()
    for sep in ("–", "-"):
        if sep in s:
            try:
                return float(s.split(sep)[0].strip())
            except ValueError:
                pass
    try:
        return float(s)
    except ValueError:
        return np.nan


# ------------------------------------------------------------------
# Script entry-point
# ------------------------------------------------------------------

if __name__ == "__main__":
    validator = SpeciesDataValidator(r'C:\Users\rasmu\FoodPlan Project\FarmPlan-Test-Data\optimizer\data\Fixed_dataset.csv')
    validator.load().validate()
    validator.print_report()

    print("\n\nValid species by strata (with complete data):")
    for strata, species_df in validator.get_species_by_strata().items():
        print(f"\n{strata}: {len(species_df)} species")
        for _, row in species_df.head(3).iterrows():
            print(
                f"  - {row['German name']} ({row['English name']}): "
                f"~{row['calories_min']:,.0f} kcal, {row['spacing_m']:.2f}m spacing"
            )