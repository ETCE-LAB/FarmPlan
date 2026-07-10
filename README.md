  ## 🌾 Project Overview

   FarmPlan uses **Syntropic Farming** to:

   - **Design farm layouts** by drawing fields on interactive maps
   - **Auto-generate optimal crop placements** using pre-calculated plant positioning
   - **Analyze soil and climate conditions** for each field
   - **Browse plant databases** with detailed species information
   - **Visualize farm plans** with stratified tree/plant layers
   - **Manage multiple farms** with persistent data storage
   - **Maximum Calorie Generation** per sq(m) for the given field and database

   ### Key Features

   ✨ **Interactive Map Interface** - Draw and edit field polygons using Leaflet & Geoman, real-time visualization, location search

   🤖 **ML-Powered Plant Placement** - Automatic crop alignment, respects spacing requirements, multiple stratification layers

   🌱 **Plant Database** - Different species, filterable by category/strata/hardiness, detailed plant information

   📊 **Farm Analytics** - Soil type detection, hardiness zone analysis, yield projections, area calculations

   🎨 **Theme Management** - Light/Dark mode, customizable colors, responsive design

   🌍 **Multi-language Support** - i18n internationalization framework

   ---

   ## 🏗️ Technology Stack

   **Frontend:** React 18, Vite, Leaflet, Leaflet-Geoman, React-Leaflet, Recharts, i18next, Lucide React, Proj4

   **Backend:** Flask, MongoDB, PyMongo, Rasterio, Shapely, NumPy, python-dotenv

   **DevOps:** Node.js, npm, ESLint, Babel, Concurrently

   ---

   ## 📋 Prerequisites

   - **Node.js** v18+ - https://nodejs.org/
   - **Python** v3.9+ - https://www.python.org/
   - **MongoDB** - https://www.mongodb.com/
   - **Git** - https://git-scm.com/

   ### Verify Installation

   ```bash
   node --version && npm --version && python --version
   ```

   ---

   ## 🚀 Installation & Setup

   ### 1. Clone Repository

   ```bash
   git clone https://github.com/ETCE-LAB/FarmPlan.git
   cd farmplan
   ```

   ### 2. Backend Setup

   ```bash
   # Create Python virtual environment
   python -m venv .venv

   # Activate virtual environment
   # Windows:
   .\.venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate

   # Install Python dependencies
   pip install -r requirements.txt
   ```

   ### 3. Frontend Setup

   ```bash
   # Install Node dependencies
   npm install
   ```

   ### 4. Environment Configuration

   Create `.env` file in `farmplan/` directory:

   ```env
   # MongoDB Configuration (Local)
   MONGO_URI=mongodb://localhost:27017
   MONGO_DB=farmplan
   MONGO_FARMS_COLLECTION=farms

   # For MongoDB Atlas (Cloud):
   # MONGO_USERNAME=your_username
   # MONGO_PASSWORD=your_password
   # MONGO_CLUSTER=your_cluster.mongodb.net

   # Flask Configuration
   FLASK_PORT=5000
   FLASK_ENV=development
   ```

   ### 5. Verify MongoDB Connection

   ```bash
   python -c "from pymongo import MongoClient; print(MongoClient('mongodb://localhost:27017').server_info())"
   ```

   ---

   ## 🎯 Running the Application

   ### Development Mode (Recommended)

   ```bash
   npm run dev:full
   ```

   Starts:
   - Vite dev server on http://localhost:... 
   - Flask backend on http://localhost:....
   - Auto-reloads on code changes

   ### Run Separately

   **Terminal 1 - Frontend:**
   ```bash
   npm run dev:frontend
   # http://localhost:...
   ```

   **Terminal 2 - Backend:**
   ```bash
   npm run dev:backend
   # http://localhost:....
   ```

   ### Production Build

   ```bash
   npm run build       # Optimized frontend
   npm run preview     # Preview production build
   ```

   ---

   ## 📱 Using FarmPlan

   ### Quick Start

   1. **Open App** → http://localhost:....
   2. **Create Farm** → Fill form, click "Save Farm"
   3. **Draw Field** → Use drawing tool on map
   4. **Save Field** → Configure options, click "Save Field"
   5. **View Results** → Crops auto-generate at optimal positions!

   ### Core Workflows

   #### Creating a Farm
   1. Fill "Register New Farm" form (all required except Notes)
   2. Click "Save Farm"
   3. Farm appears in the list

   #### Drawing & Saving Fields
   1. Select a farm
   2. Search the location
   3. Click drawing tool on map
   4. Click points to create polygon (minimum 3 points)
   5. Double-click/press Enter to finish
   6. Configure:
      - Field Name (required)
      - Crop Type (optional)
      - Soil Type (auto or manual)
      - Irrigation (toggle)
      - Auto-spacing (ON recommended) 
   7. Click "Save Field"

   #### Creating Templates
   1. Select field
   2. Click "Create new template" or "Generate template"
   3. Search and select plants
   4. Click "Save template"
   5. Future fields use these plants

   *Note*: Generate Template automatically places the plants in the field

   #### Browsing Plants
   1. Go to "Plants Inventory" tab
   2. Search by name
   3. Filter by category/strata/hardiness
   4. View plant details

   
   ---

   ## 📁 Project File Structure

   Complete directory layout to help you find what you need:

   ```
   FarmPlan/
   │
   ├── farmplan/                               # Main application directory
   │   ├── src/                                # Frontend source code
   │   │   ├── components/
   │   │   │   ├── shared/                     # Reusable components
   │   │   │   │   ├── Sidebar.jsx            # Left navigation
   │   │   │   │   ├── TopBar.jsx             # Top navigation
   │   │   │   │   └── ...
   │   │   │   ├── tabs/                       # Tab-based sections
   │   │   │   │   ├── overview/              # Dashboard & analytics
   │   │   │   │   │   ├── StatsRow.jsx       # Farm statistics
   │   │   │   │   │   ├── SoilLookupPanel.jsx
   │   │   │   │   │   └── YieldChartPanel.jsx
   │   │   │   │   ├── planning/              # Farm & field design
   │   │   │   │   │   ├── FarmCreationPanel.jsx    # Main planning interface
   │   │   │   │   │   ├── FarmEditPanel.jsx
   │   │   │   │   │   ├── PlantsPanel.jsx         # Plant inventory
   │   │   │   │   │   ├── planningComponents/
   │   │   │   │   │   │   ├── field/              # Field configuration
   │   │   │   │   │   │   │   ├── FieldPropertiesPanel.jsx
   │   │   │   │   │   │   │   ├── FieldClimatePanel.jsx
   │   │   │   │   │   │   │   ├── Template.jsx
   │   │   │   │   │   │   │   └── DragDropCrops.jsx
   │   │   │   │   │   │   ├── farm/               # Farm management
   │   │   │   │   │   │   │   ├── FarmList.jsx
   │   │   │   │   │   │   │   └── StrataLegend.jsx
   │   │   │   │   │   │   └── map/                # Map visualization
   │   │   │   │   │   │       ├── FarmMap.jsx
   │   │   │   │   │   │       ├── CropPlacementLayer.jsx
   │   │   │   │   │   │       ├── TreelineLayer.jsx
   │   │   │   │   │   │       └── MapNavigator.jsx
   │   │   │   │   │   ├── utils/
   │   │   │   │   │   │   ├── geometry.js          # Polygon/spacing calculations
   │   │   │   │   │   │   ├── constants.js
   │   │   │   │   │   │   └── treelines.js
   │   │   │   │   │   └── style/
   │   │   │   │   │       └── FarmCreationPanel.css
   │   │   │   │   ├── inventory/              # Field inventory viewer
   │   │   │   │   │   ├── FieldInventoryPanel.jsx
   │   │   │   │   │   └── inventory.css
   │   │   │   │   ├── editing/                # Edit existing data
   │   │   │   │   │   └── FarmEditPanel.jsx
   │   │   │   │   └── settings/               # Configuration
   │   │   │   │       └── ThemeConfigurationPanel.jsx
   │   │   │   └── style/                      # Component stylesheets
   │   │   │
   │   │   ├── utils/
   │   │   │   ├── dashboardApi.js             # Backend API calls (farms, plants, hardiness)
   │   │   │   ├── themeVariables.js           # Theme configuration
   │   │   │   ├── soilUtils.js                # Soil type utilities
   │   │   │   └── index.js
   │   │   │
   │   │   ├── config/
   │   │   │   └── dashboardTabs.js            # Tab definitions & routing
   │   │   │
   │   │   ├── data/
   │   │   │   └── dashboardData.js            # Mock/default data
   │   │   │
   │   │   ├── i18n.js                         # Internationalization setup
   │   │   ├── App.jsx                         # Main React component
   │   │   ├── App.css                         # Global styles
   │   │   ├── main.jsx                        # React entry point
   │   │   └── index.css                       # Global CSS
   │   │
   │   ├── backend/
   │   │   ├── app.py                          # Flask application & API routes
   │   │   ├── plant_images.py                 # Plant image database seeding
   │   │   ├── 20260320_Neorx-treeline-planning.csv    # Plant species database
   │   │   └── hardiness_zones_1990_2024_every_2y.tif  # Climate/hardiness raster data
   │   │
   │   ├── optimizer/                          # AI/ML optimization engine
   │   │   ├── data/
   │   │   │   └── Fixed_dataset_corrected.csv        # 110 species with strata
   │   │   ├── models/
   │   │   │   ├── calorie_scoring_model.json         # Trained XGBoost model
   │   │   │   ├── calorie_scoring_model.meta.json    # Model metadata
   │   │   │   └── metrics.json                       # Training metrics
   │   │   ├── output/
   │   │   │   ├── plan_placements.json               # Optimized crop positions (used by FarmPlan)
   │   │   │   ├── plan_result.json
   │   │   │   └── demo_results.json
   │   │   ├── notebooks/
   │   │   │   └── analysis.ipynb                     # Jupyter analysis notebook
   │   │   ├── data_loader.py                         # Phase 1: Load & validate species
   │   │   ├── constraint_sampler.py                  # Phase 2: Constraint satisfaction
   │   │   ├── strata_optimizer.py                    # Phase 3: Hierarchical placement
   │   │   ├── models.py                              # Phase 4: XGBoost model class
   │   │   ├── train.py                               # Phase 4: Model training pipeline
   │   │   ├── end_to_end.py                          # Phase 5: Beam search optimizer
   │   │   ├── demo.py                                # Quick demo script
   │   │   ├── README.md                              # Optimizer documentation
   │   │   ├── IMPLEMENTATION_SUMMARY.md              # Detailed technical notes
   │   │   ├── QUICKSTART.md                          # Quick start guide
   │   │   └── requirements.txt                       # Python dependencies
   │   │
   │   ├── scripts/
   │   │   ├── dev-backend.mjs                 # Development script for Flask
   │   │   └── translate.js                    # i18n translation script
   │   │
   │   ├── public/                             # Static assets
   │   │   ├── favicon.svg
   │   │   ├── icons.svg
   │   │   └── ...
   │   │
   │   ├── node_modules/                       # NPM packages (created by npm install)
   │   ├── .venv/                              # Python virtual environment
   │   ├── .env                                # Environment variables (create this)
   │   ├── .gitignore                          # Git ignore rules
   │   ├── package.json                        # NPM dependencies & scripts
   │   ├── package-lock.json                   # Locked dependency versions
   │   ├── requirements.txt                    # Python dependencies
   │   ├── vite.config.js                      # Vite build configuration
   │   ├── eslint.config.js                    # ESLint linting rules
   │   ├── index.html                          # HTML entry point
   │   └── README.md                           # This file
   │
   └── Documentation/
       ├── DATALICENSE&ATTRIBUTION             # Plant data license & credits
       └── ...
   ```

   ### Key Directories Explained

   **`src/`** - React frontend application
   - Components organized by feature (tabs)
   - Utilities for API calls, themes, calculations
   - Configuration and data files

   **`backend/`** - Flask REST API
   - Routes for farms, plants, hardiness analysis
   - Plant database (CSV)
   - Geospatial data (GeoTIFF rasters)

   **`optimizer/`** - AI/ML optimization engine
   - 5-phase pipeline for crop placement
   - Trained XGBoost model
   - Pre-calculated optimal placements

   **`public/`** - Static assets
   - Favicon, icons, images
   - Served directly by Vite

   **`scripts/`** - Helper scripts
   - Development server startup
   - i18n translation tooling

   ### Important Config Files

   - **`.env`** - Environment variables (create manually)
   - **`package.json`** - NPM scripts and dependencies
   - **`requirements.txt`** - Python dependencies
   - **`vite.config.js`** - Frontend build configuration
   - **`eslint.config.js`** - Code quality rules

   ---

   ## 🔧 Development Scripts

   ```bash
   npm run dev:frontend      # Frontend only
   npm run dev:backend       # Backend only
   npm run dev:full          # Both concurrently
   npm run build             # Production build
   npm run preview           # Preview build
   npm run lint              # ESLint check
   npm run i18n              # i18n translation
   npm run start             # Vite dev server
   ```

   ---

   ## ⚠️ Limitations

   > For the full picture of how the optimizer and backend work, and how the plant/species data is licensed, also check out **`optimizer/README.md`**, **`backend/README.md`**, and **`DATALICENSE&ATTRIBUTION`**.


  - The current optimization model is designed specifically for a single field—the **Nerox field**. Plant placement, spacing calculations, and tree line logic are tailored to this field's shape, size, and existing tree line layout. We are actively working on generalizing the optimizer to support fields with different geometries, dimensions, and tree line configurations.

  - At the moment, plant positions within tree lines are **not determined by the optimizer**. Instead, plants are snapped to the nearest tree line, and any plants located outside the field boundary are automatically snapped back into the field polygon. Additionally, field and optimizer coordinates are aligned by using the southernmost, easternmost, and westernmost field corners. This approach assumes that the bottom corner is the outermost point of the field, which means the current alignment method does not work reliably for every field shape.

  - The ML-powered placement system also relies on **pre-calculated plant positioning**. As a result, placement quality depends on the underlying dataset and is not yet dynamically recomputed for arbitrary field geometries.

  - Soil type and climate zone detection depend on external raster and geospatial datasets, which may not provide complete coverage for all regions. Multi-language (i18n) support is still incomplete, and some parts of the user interface remain untranslated. In addition, the platform does not yet provide built-in support for multi-user collaboration or role-based access control for shared farms.

   ---

   ## 🚧 Future Work

   - Generalize the optimizer to support arbitrary field shapes, sizes, and tree line layouts beyond the current Nerox field.
   - Extend the placement algorithm to dynamically recompute plant positions in real time rather than relying solely on pre-calculated placements.
   - Improve soil and climate analytics with broader geospatial data source coverage.
   - Add yield forecasting improvements based on historical and seasonal data.
   - Expand multi-language support with complete translations across the UI.
   - Add multi-user collaboration features (shared farms, permissions, activity history).
   - Improve mobile responsiveness and offline support for field-based data entry.

   ---

   ## 🐛 Troubleshooting

   **MongoDB Connection Failed**
   - Start MongoDB: `mongosh`
   - Check .env MONGO_URI
   - Verify network connectivity

   **Port Already in Use**
   - Change FLASK_PORT in .env
   - Kill process: `lsof -ti:5000 | xargs kill -9`

   **Plant Database Not Loading**
   - Verify CSV exists in `backend/` folder
   - Check TREELINE_CSV_PATH in .env

   **Crops Not Auto-Aligning**
   - Check `optimizer/output/plan_placements.json` exists
   - Open browser console (F12) for errors
   - Ensure field has 3+ points

   **Frontend Build Fails**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run dev:full
   ```

   ---

   ## 📖 Contributing for further development

   1. Fork repository
   2. Create feature branch: `git checkout -b feature/my-feature`
   3. Commit: `git commit -m "Add my feature"`
   4. Push: `git push origin feature/my-feature`
   5. Open Pull Request

   **Code Standards:**
   - Run `npm run lint` before committing
   - Follow React best practices
   - Comment non-obvious logic

   ---
