import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from constraint_sampler import ConstraintSampler, SpeciesPlacement
import logging

logger = logging.getLogger(__name__)


class StrataOptimizer:
    """Orchestrates hierarchical strata-based placement."""

    def __init__(
        self,
        species_df: pd.DataFrame,
        field_width_m: float = 100.0,
        field_height_m: float = 100.0,
    ):
        self.species_df = species_df.copy()
        self.field_width_m = field_width_m
        self.field_height_m = field_height_m

        self.strata_order = [
            "Emergent canopy",
            "High canopy",
            "Medium/High tree",
            "Medium tree",
            "Low/medium tree",
            "Low tree",
            "Shrub layer",
            "Climber/liana",
            "Tall herb",
            "Tall herb geophyte",
            "Herb geophyte",
            "Herb",
            "Groundcover",
            "Tall emergent wetland",
            "Herb aquatic",
            "Wetland herb geophyte",
            "Aquatic rhizome",
        ]

        self.strata_species = self._build_strata_map()
        logger.info(f"Initialized StrataOptimizer with {len(self.strata_species)} strata")

    # ------------------------------------------------------------------

    def _build_strata_map(self) -> Dict[str, pd.DataFrame]:
        """Build map of strata → valid species (those with numeric calories & spacing)."""
        strata_map = {}
        for strata in self.strata_order:
            subset = self.species_df[
                (self.species_df["Strata"] == strata)
                & self.species_df["calories_min"].notna()
                & self.species_df["spacing_m"].notna()
            ].copy()
            if len(subset) > 0:
                strata_map[strata] = subset
        return strata_map

    def compute_plan_calories(self, sampler: ConstraintSampler, plan: Dict) -> float:
        """Compute total calories for all placements in a plan."""
        total_cal = 0.0

        # BUG FIX: the original iterated over plan['placed_species'] which is
        # a flat list and counted occurrences via sum(1 for p in ...).  That
        # worked but was O(N²).  We instead sum directly over sampler.placements
        # which is O(N) and the ground truth anyway.
        for placement in sampler.placements:
            matching = self.species_df[self.species_df["ID"] == placement.species_id]
            if len(matching) > 0:
                total_cal += float(matching.iloc[0]["calories_min"])

        return total_cal

    def generate_random_plan(
        self,
        target_species_per_strata: int = 3,
        max_placement_attempts: int = 100,
    ) -> Tuple[ConstraintSampler, Dict]:
        """
        Generate a single random valid plan using classical rejection sampling.

        BUG FIX: the original code reused the same viable placement objects
        via `viable[i % len(viable)]`, meaning the *same grid cell* could be
        attempted for multiple instances of the same species.  After the first
        instance occupies that cell, `place_species` correctly rejects
        subsequent attempts — but it is wasteful and confusing.  We now draw
        distinct positions by slicing the viable list.
        """
        sampler = ConstraintSampler(self.field_width_m, self.field_height_m)
        plan: Dict = {"placed_species": [], "placements": []}

        for strata in self.strata_order:
            if strata not in self.strata_species:
                continue

            species_in_strata = self.strata_species[strata]
            n_to_place = min(target_species_per_strata, len(species_in_strata))
            selected_species = species_in_strata.sample(n=n_to_place, random_state=None)

            for _, species_row in selected_species.iterrows():
                species_id = species_row["ID"]
                spacing_m = float(species_row["spacing_m"])

                viable = sampler.generate_viable_placements(
                    species_id, spacing_m, max_candidates=100, max_viable=20
                )
                if not viable:
                    continue

                # BUG FIX: choose how many instances to place but never more
                # than the number of *distinct* viable positions.
                n_instances = np.random.randint(1, min(4, len(viable) + 1))

                # BUG FIX: iterate over unique positions, not wrap-around indices.
                for placement in viable[:n_instances]:
                    if sampler.place_species(placement):
                        plan["placed_species"].append(species_id)
                        plan["placements"].append(
                            {
                                "species_id": species_id,
                                "x": placement.grid_x,
                                "y": placement.grid_y,
                                "calories_per_plant": float(species_row["calories_min"]),
                            }
                        )

        plan["total_calories"] = self.compute_plan_calories(sampler, plan)
        plan["total_cells_used"] = len(sampler.placements)

        return sampler, plan

    def beam_search_with_top_plans(
        self, n_plans: int = 100, target_species_per_strata: int = 3
    ) -> List[Dict]:
        """Generate n_plans random plans and return the top 10% by calorie yield."""
        plans = []
        for i in range(n_plans):
            _, plan = self.generate_random_plan(target_species_per_strata)
            plans.append(plan)
            if (i + 1) % 10 == 0:
                logger.info(f"Generated {i + 1}/{n_plans} plans")

        plans.sort(key=lambda p: p["total_calories"], reverse=True)
        top_k = max(1, len(plans) // 10)
        top_plans = plans[:top_k]

        logger.info(
            f"Top plan has {top_plans[0]['total_calories']:,.0f} kcal "
            f"({top_plans[0]['total_cells_used']} placements)"
        )
        return top_plans


if __name__ == "__main__":
    from data_loader import SpeciesDataValidator

    validator = SpeciesDataValidator()
    validator.load().validate()

    optimizer = StrataOptimizer(validator.df, field_width_m=100, field_height_m=100)

    print("\n=== Single Plan Test ===")
    sampler, plan = optimizer.generate_random_plan(target_species_per_strata=2)
    print(f"Total calories: {plan['total_calories']:,.0f}")
    print(f"Placements: {len(plan['placements'])}")
    print(f"Unique species: {len(set(p['species_id'] for p in plan['placements']))}")

    print("\n=== Beam Search Test ===")
    top_plans = optimizer.beam_search_with_top_plans(n_plans=20, target_species_per_strata=3)
    print(f"Top 10%: {len(top_plans)} plans")
    for i, p in enumerate(top_plans[:3]):
        print(f"  Plan {i+1}: {p['total_calories']:,.0f} kcal, {p['total_cells_used']} placements")