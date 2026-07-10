import numpy as np
from dataclasses import dataclass
from typing import Tuple, List, Dict
import logging

logger = logging.getLogger(__name__)


@dataclass
class SpeciesPlacement:
    """Single species instance on the grid."""
    species_id: str
    grid_x: int
    grid_y: int
    spacing_m: float


@dataclass
class GridCell:
    """Represents a 50 cm × 50 cm cell."""
    CELL_SIZE_CM = 50
    CELL_SIZE_M = CELL_SIZE_CM / 100.0

    def center_position_m(self, x: int, y: int) -> Tuple[float, float]:
        return (
            x * self.CELL_SIZE_M + self.CELL_SIZE_M / 2,
            y * self.CELL_SIZE_M + self.CELL_SIZE_M / 2,
        )


class ConstraintSampler:
    """Classical rejection sampler for valid placements respecting spacing constraints."""

    def __init__(
        self,
        field_width_m: float,
        field_height_m: float,
        syntropic_min_spacing_m: float = 1.0,
        polygon_m: "list[tuple[float, float]] | None" = None,
        max_species_spacing_m: float = 12.0,
    ):
        self.field_width_m = field_width_m
        self.field_height_m = field_height_m
        self.syntropic_min_spacing_m = syntropic_min_spacing_m
        self.polygon_m = polygon_m
        # The largest spacing of any species in the dataset (black walnut = 12 m).
        # check_spacing_constraint must search at least this far from the candidate
        # cell so it can detect large-spacing trees already placed nearby.
        self.max_species_spacing_m = max_species_spacing_m

        cell_size = GridCell.CELL_SIZE_M
        self.grid_width = int(np.ceil(field_width_m / cell_size))
        self.grid_height = int(np.ceil(field_height_m / cell_size))
        self.total_cells = self.grid_width * self.grid_height

        self.grid: Dict[Tuple[int, int], SpeciesPlacement] = {}
        self.placements: List[SpeciesPlacement] = []

        logger.info(
            f"Initialized grid {self.grid_width} x {self.grid_height} "
            f"({self.total_cells} cells) for {field_width_m}m x {field_height_m}m field"
            + (f" with polygon mask ({len(polygon_m)} pts)" if polygon_m else "")
        )

    # ------------------------------------------------------------------
    # Polygon masking
    # ------------------------------------------------------------------

    def set_polygon(self, polygon_m: "list[tuple[float, float]]"):
        self.polygon_m = polygon_m

    def _point_in_polygon(self, px: float, py: float) -> bool:
        if self.polygon_m is None:
            return True
        inside = False
        n = len(self.polygon_m)
        j = n - 1
        for i in range(n):
            xi, yi = self.polygon_m[i]
            xj, yj = self.polygon_m[j]
            if ((yi > py) != (yj > py)) and (
                px < (xj - xi) * (py - yi) / (yj - yi) + xi
            ):
                inside = not inside
            j = i
        return inside

    # ------------------------------------------------------------------

    def reset(self):
        self.grid.clear()
        self.placements.clear()

    def distance_between_cells(self, x1: int, y1: int, x2: int, y2: int) -> float:
        cell = GridCell()
        pos1 = cell.center_position_m(x1, y1)
        pos2 = cell.center_position_m(x2, y2)
        return float(np.sqrt((pos1[0] - pos2[0]) ** 2 + (pos1[1] - pos2[1]) ** 2))

    def get_affected_cells(
        self, x: int, y: int, radius_m: float
    ) -> List[Tuple[int, int]]:
        cell = GridCell()
        radius_cells = int(np.ceil(radius_m / cell.CELL_SIZE_M))
        affected = []
        for dx in range(-radius_cells, radius_cells + 1):
            for dy in range(-radius_cells, radius_cells + 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.grid_width and 0 <= ny < self.grid_height:
                    if self.distance_between_cells(x, y, nx, ny) <= radius_m:
                        affected.append((nx, ny))
        return affected

    def check_spacing_constraint(self, x: int, y: int, spacing_m: float) -> bool:
        """
        Return True if placing a plant with *spacing_m* at (x, y) is valid.

        ROOT-CAUSE FIX: the search radius must be wide enough to find every
        existing plant whose OWN spacing requirement could exclude the
        candidate cell — not just the candidate's own radius.

        Example of the old bug:
          A walnut (10 m) is already placed.  A herb (effective spacing 1 m)
          is being tested 5 m away.  Old code searched only 1 m around the
          herb, never found the walnut, and wrongly returned True.

        Fix: search max(candidate_spacing, max_species_spacing_m) so we
        always look far enough to find any previously-placed large tree.
        """
        if not (0 <= x < self.grid_width and 0 <= y < self.grid_height):
            return False

        # Search radius = largest of candidate spacing, global max species
        # spacing, and syntropic minimum.  This guarantees we examine every
        # existing plant whose exclusion zone could reach (x, y).
        search_radius = max(
            spacing_m,
            self.syntropic_min_spacing_m,
            self.max_species_spacing_m,
        )
        affected = self.get_affected_cells(x, y, search_radius)

        for ax, ay in affected:
            if (ax, ay) in self.grid:
                dist = self.distance_between_cells(x, y, ax, ay)
                existing = self.grid[(ax, ay)]
                min_required = max(
                    spacing_m,
                    existing.spacing_m,
                    self.syntropic_min_spacing_m,
                )
                if dist < min_required:
                    return False

        return True

    def sample_random_cells(self, n_samples: int) -> List[Tuple[int, int]]:
        """Return up to n_samples randomly chosen empty cells inside the polygon."""
        cell = GridCell()
        all_cells = [
            (x, y)
            for x in range(self.grid_width)
            for y in range(self.grid_height)
            if (x, y) not in self.grid
            and self._point_in_polygon(*cell.center_position_m(x, y))
        ]
        if not all_cells:
            return []
        n = min(n_samples, len(all_cells))
        indices = np.random.choice(len(all_cells), n, replace=False)
        return [all_cells[i] for i in indices]

    def generate_viable_placements(
        self,
        species_id: str,
        spacing_m: float,
        max_candidates: int = 1000,
        max_viable: int = 100,
    ) -> List[SpeciesPlacement]:
        """Generate viable placements by rejection sampling (polygon-aware)."""
        effective_spacing = max(spacing_m, self.syntropic_min_spacing_m)

        viable = []
        candidates = self.sample_random_cells(max_candidates)

        for x, y in candidates:
            if self.check_spacing_constraint(x, y, effective_spacing):
                viable.append(SpeciesPlacement(species_id, x, y, effective_spacing))
                if len(viable) >= max_viable:
                    break

        return viable

    def place_species(self, placement: SpeciesPlacement) -> bool:
        """Place species on grid if the position is still valid. Returns success."""
        if not self.check_spacing_constraint(
            placement.grid_x, placement.grid_y, placement.spacing_m
        ):
            return False

        self.grid[(placement.grid_x, placement.grid_y)] = placement
        self.placements.append(placement)
        return True

    def get_grid_state(self) -> np.ndarray:
        grid_array = np.full((self.grid_height, self.grid_width), -1, dtype=int)
        for (x, y), placement in self.grid.items():
            grid_array[y, x] = hash(placement.species_id) % 256
        return grid_array

    def get_placements_dict(self) -> Dict:
        return {
            "placements": [
                {
                    "species_id": p.species_id,
                    "grid_x": p.grid_x,
                    "grid_y": p.grid_y,
                    "spacing_m": p.spacing_m,
                    "position_m": GridCell().center_position_m(p.grid_x, p.grid_y),
                }
                for p in self.placements
            ],
            "grid_shape": (self.grid_width, self.grid_height),
            "field_size_m": (self.field_width_m, self.field_height_m),
            "polygon_m": self.polygon_m,
        }


if __name__ == "__main__":
    FIELD_POLYGON_M = [
        (0, 15), (10, 0), (58, 8), (60, 32), (45, 40), (5, 38), (0, 15)
    ]

    sampler = ConstraintSampler(
        field_width_m=60,
        field_height_m=40,
        syntropic_min_spacing_m=1.0,
        polygon_m=FIELD_POLYGON_M,
        max_species_spacing_m=12.0,
    )

    print(f"Grid: {sampler.grid_width} x {sampler.grid_height} = {sampler.total_cells} cells")

    viable_walnut = sampler.generate_viable_placements(
        "T01_Walnut", spacing_m=10.0, max_candidates=200, max_viable=10
    )
    print(f"Viable Walnut placements (polygon-masked): {len(viable_walnut)}")

    if viable_walnut:
        sampler.place_species(viable_walnut[0])
        wx, wy = viable_walnut[0].grid_x, viable_walnut[0].grid_y
        print(f"Placed Walnut at ({wx}, {wy})")

        # Verify a herb placed 5m away is correctly rejected
        herb = SpeciesPlacement("P22_Strawberry", wx + 10, wy, 1.0)
        result = sampler.place_species(herb)
        dist = sampler.distance_between_cells(wx, wy, wx + 10, wy)
        print(f"Herb 5m away correctly rejected: {not result}  (dist={dist:.2f}m, need 10m)")

    viable_apple = sampler.generate_viable_placements(
        "T11_Apple", spacing_m=6.0, max_candidates=200, max_viable=10
    )
    print(f"Viable Apple placements (respecting walnut): {len(viable_apple)}")
    print(f"Total placed: {len(sampler.placements)}")