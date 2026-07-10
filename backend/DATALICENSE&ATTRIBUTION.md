# DATA LICENSE & ATTRIBUTION

This project uses climate data from the CHELSA dataset to generate a derived hardiness zone raster for Germany.

---

## 1. Data Source

Hardiness zone computation is based on CHELSA daily climate data:

- Dataset: CHELSA-daily (Climatologies at High Resolution for the Earth’s Land Surface Areas)
- Source: https://www.chelsa-climate.org/datasets/chelsa_daily
- Data access: https://os.unil.cloud.switch.ch/chelsa02/chelsa/global/daily/tasmin/
- Portal: https://envicloud.wsl.ch/#/?bucket=https%3A%2F%2Fos.unil.cloud.switch.ch%2Fchelsa02%2F&prefix=chelsa%2Fglobal%2Fdaily%2Ftasmin%2F

---

## 2. Data Usage in This Project

This project uses a **subset and transformation** of CHELSA-daily data:

- Time range used: 1990–2024  
- Sampling interval: every 2 years (excluding 2022)  
- Months used: January, February, March, April, December  
- Metric: yearly minimum temperature derived from selected months  
- Output: derived raster used to compute hardiness zones

From this processed dataset, we generated a **hardiness zone GeoTIFF** used in polygon-based farm analysis.

---

## 3. License

CHELSA-daily data is released under:

> **Creative Commons Zero (CC0 1.0) — No Rights Reserved**

This means the data is in the public domain and may be used, modified, and redistributed without restriction.

License details:  
https://creativecommons.org/publicdomain/zero/1.0/

---

## 4. Important Note

This project does not redistribute raw CHELSA data.

Instead, it uses a **derived product (hardiness zone raster)** generated from processed CHELSA-daily temperature data for analytical purposes within the FarmPlan backend.