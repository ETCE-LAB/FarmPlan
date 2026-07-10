# FarmPlan Backend

This folder contains the Flask backend for the FarmPlan dashboard. It reads the treeline CSV file, stores the data in MongoDB, and provides the API that the frontend uses.

## What it does

- checks if the backend is running with `/api/health`
- imports the CSV into MongoDB with `/api/treeline/import`
- returns dashboard summary data with `/api/treeline/overview`
- returns paginated plant records with `/api/treeline/records`
- returns hardineszone for a field `/api/hardiness/field`
- automatically imports the CSV if the database is still empty

## What you need

- Python 3.10 or newer
- MongoDB running locally or through `MONGO_URI`
- the CSV file `20260320_Neorx-treeline-planning.csv` in this folder
- the GeoTIFF hardiness raster `hardiness_zones_1990_2024_every_2y.tif`

## Setup

Open the `backend` folder and run:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Configuration

The backend uses these environment variables:

- `MONGO_URI` - MongoDB connection string. Default is `mongodb+srv://farmplan_Demo:s9DpySkryHGHl0yR@cluster0.ihcfaul.mongodb.net/`
- `MONGO_DB` - Database name. Default is `farmplan`
- `MONGO_COLLECTION` - Collection name. Default is `treeline_planning`
- `TREELINE_CSV_PATH` - Path to the CSV file used for imports. Default is `20260320_Neorx-treeline-planning.csv`
- `HARDINESS_RASTER_PATH` - Path to the GeoTIFF hardiness raster. Default is `hardiness_zones_1990_2024_every_2y.tif`
- `FLASK_PORT` - Port for the Flask server. Default is `5000`

If you want different values, create a `.env` file in this folder.

Example:

```env
MONGO_URI=mongodb+srv://farmplan_Demo:s9DpySkryHGHl0yR@cluster0.ihcfaul.mongodb.net/
MONGO_DB=farmplan
MONGO_COLLECTION=treeline_planning
TREELINE_CSV_PATH=20260320_Neorx-treeline-planning.csv
FLASK_PORT=5000
HARDINESS_RASTER_PATH=hardiness_zones_1990_2024_every_2y.tif
```

## Run it

Start the backend with:

```bash
python app.py
```

The server listens on `0.0.0.0` and uses the port from the config.

## API Endpoints

### `GET /api/health`

Returns a simple status response to show the backend is working.

Example request:

```bash
curl http://localhost:5000/api/health
```

Example response:

```json
{
  "status": "ok"
}
```

### `POST /api/treeline/import`

Imports the CSV into MongoDB.

Request body:

```json
{
  "reset": true,
  "csvPath": "20260320_Neorx-treeline-planning.csv"
}
```

Example request:

```bash
curl -X POST http://localhost:5000/api/treeline/import \
  -H "Content-Type: application/json" \
  -d '{
    "reset": true,
    "csvPath": "20260320_Neorx-treeline-planning.csv"
  }'
```

Example response:

```json
{
  "status": "ok",
  "importedRows": 128,
  "csvPath": "<absolute path to CSV>"
}
```

### `GET /api/treeline/overview`

Returns the summary data used by the dashboard, like stats, field logs, performance data, and metadata.

Example request:

```bash
curl http://localhost:5000/api/treeline/overview
```

Example response:

```json
{
  "stats": [
    { "label": "Total entries", "value": "128", "unit": "plants" },
    { "label": "Categories", "value": "6", "unit": "types" },
    { "label": "Avg end height", "value": "2.45", "unit": "m" },
    { "label": "Mean calories", "value": "1840", "unit": "kcal" }
  ],
  "fieldLogs": [
    {
      "id": "A001",
      "name": "Apfelbaum",
      "crop": "Apple",
      "strata": "tree",
      "typicalShare": "10 - 20",
      "hardiness": "6a;6b"
    }
  ],
  "performance": [
    { "week": "A021", "value": 3200 }
  ],
  "meta": {
    "csvPath": "<absolute path to CSV>",
    "totalEntries": 128,
    "hardinessZones": 9
  }
}
```

### `GET /api/treeline/records`

Returns the plant records in pages.

Query parameters:

- `page` - page number, default `1`
- `limit` - page size, default `10`, max `100`
- `search` - text search across source ID and plant names
- `category` - filter by category
- `strata` - filter by strata
- `hardiness` - filter by hardiness zone list

Example request:

```bash
curl "http://localhost:5000/api/treeline/records?page=1&limit=10&search=oak"
```

Example response:

```json
{
  "records": [
    {
      "id": "A001",
      "name": "Apfelbaum",
      "crop": "Apple",
      "strata": "tree",
      "typicalShare": "10 - 20",
      "hardiness": "6a;6b",
      "category": "fruit",
      "calories": 1840,
      "rawDetails": {
        "source_id": "A001",
        "german_name": "Apfelbaum"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 128,
    "totalPages": 13,
    "hasPrev": false,
    "hasNext": true
  },
  "filters": {
    "search": "oak",
    "category": "all",
    "strata": "all",
    "hardiness": "all"
  },
  "options": {
    "categories": ["fruit", "vegetable"],
    "strata": ["tree", "shrub"],
    "hardinessZones": ["6a", "6b", "7a"]
  }
}
```

### `POST /api/hardiness/field`

Analyzes a field polygon against the hardiness GeoTIFF raster and returns hardiness zone information.

The endpoint:

* clips the raster to the submitted polygon
* calculates zone distribution percentages
* returns the dominant hardiness zone
* also gives the temperature range for the dominant zone
* reports how many raster pixels it intersects

## Request Body

The polygon must contain at least **3 coordinates**.

Coordinates must be provided in:

```text
[latitude, longitude]
```

Example request:

```bash
curl -X POST http://localhost:5000/api/hardiness/field \
-H "Content-Type: application/json" \
-d '{
  "polygon": [
    [50.766359, 11.077382],
    [50.940246, 10.703823],
    [52.5180, 13.4150]
  ]
}'
```

Example response:

```json
{
  "status": "ok",
  "distribution": {
    "7a": 38.01,
    "7b": 61.99
  },
  "dominantZone": "7b",
  "rawPixelCount": 3389,
  "temperature": [
    -15.0,
    -12.2
  ]
}
```


## Data notes

- CSV headers are changed to lowercase snake_case before they go into MongoDB.
- Derived fields include `source_id`, `end_height_mid_m`, `lifespan_mid_years`, `expected_calories_mid`, `typical_share_mid_pct`, `hardiness_zone_list`, and `hardiness_zone_count`.
- If the collection is empty, the backend imports the default CSV the first time overview or records are requested.

- Source and creation of GeoTIFF data is listed in DATALICENSE&ATTRIBUTION.md

## Frontend use

The frontend expects this backend to be available on `localhost` during development.