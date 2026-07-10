


from datetime import date
from flask import Blueprint, jsonify, request
from pymongo import MongoClient, UpdateOne
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "farmplan")
IMAGES_COLLECTION = "plant_images"

plant_images_bp = Blueprint("plant_images", __name__)


# Seed data 


TODAY = str(date.today())  # 2026-05-22

SEED_IMAGES = [
    # ── S01 Hazelnut ────────────────────────────────────────────────────────
    {
        "source_id": "S01",
        "plant_name": "Hazelnut (Corylus avellana)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Hazelnuts.jpg/800px-Hazelnuts.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Hazelnuts.jpg",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "Fir0002/Flagstaffotos",
        "author_url": "https://en.wikipedia.org/wiki/User:Fir0002",
        "date_accessed": TODAY,
    },
    # ── S02 Sea Buckthorn ───────────────────────────────────────────────────
    {
        "source_id": "S02",
        "plant_name": "Sea Buckthorn (Hippophae rhamnoides)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Hippophae_rhamnoides_113549850.jpg/960px-Hippophae_rhamnoides_113549850.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Hippophae_rhamnoides_113549850.jpg",
        "license_name": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/deed.en",
        "author_name": "Oleg Kosterin",
        "author_url": "https://www.inaturalist.org/users/2511740",
        "date_accessed": TODAY,
    },
    # ── S03 Blackcurrant ────────────────────────────────────────────────────
    {
        "source_id": "S03",
        "plant_name": "Blackcurrant (Ribes nigrum)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Schwarze_Johannisbeeren_Makro.jpg/1920px-Schwarze_Johannisbeeren_Makro.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Schwarze_Johannisbeeren_Makro.jpg",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "Matlin (Flickr transfer)",
        "author_url": "https://commons.wikimedia.org/wiki/User:Matlin",
        "date_accessed": TODAY,
    },
    # ── S04 Red/White Currant ───────────────────────────────────────────────
    {
        "source_id": "S04",
        "plant_name": "Red/White Currant (Ribes rubrum)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/5/51/Ribes_rubrum_-_%28PL%29_Porzeczka_%2827941676160%29.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Ribes_rubrum_-_(PL)_Porzeczka_(27941676160).jpg",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Matlin",
        "author_url": "https://commons.wikimedia.org/wiki/User:Matlin",
        "date_accessed": TODAY,
    },
    # ── S05 Gooseberry ──────────────────────────────────────────────────────
    {
        "source_id": "S05",
        "plant_name": "Gooseberry (Ribes uva-crispa)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Gooseberries.jpg/1920px-Gooseberries.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Gooseberries.jpg",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "neurovelho",
        "author_url": "https://commons.wikimedia.org/wiki/User:Neurovelho",
        "date_accessed": TODAY,
    },
    # ── S06 Jostaberry ──────────────────────────────────────────────────────
    {
        "source_id": "S06",
        "plant_name": "Jostaberry (Ribes x nidigrolaria)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Ribes_nidigrolaria_fruits.jpg/1920px-Ribes_nidigrolaria_fruits.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Ribes_nidigrolaria_fruits.jpg",
        "license_name": "CC BY-SA 2.5",
        "license_url": "https://creativecommons.org/licenses/by-sa/2.5/deed.en",
        "author_name": "Simon Eugster",
        "author_url": "https://commons.wikimedia.org/wiki/User:LivingShadow",
        "date_accessed": TODAY,
    },
    # ── S07 Raspberry ───────────────────────────────────────────────────────
    {
        "source_id": "S07",
        "plant_name": "Raspberry (Rubus idaeus)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Raspberries_%28Rubus_Idaeus%29.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Raspberries_(Rubus_Idaeus).jpg",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "Cedric Puisney",
        "author_url": "https://commons.wikimedia.org/wiki/User:Cedricpuisney",
        "date_accessed": TODAY,
    },
    # ── S08 Blackberry ──────────────────────────────────────────────────────
    {
        "source_id": "S08",
        "plant_name": "Blackberry (Rubus fruticosus)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Blackberries_%28Rubus_fruticosus%29.jpg/1920px-Blackberries_%28Rubus_fruticosus%29.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Blackberries_(Rubus_fruticosus).jpg",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Cillas",
        "author_url": "https://commons.wikimedia.org/wiki/User:Cillas",
        "date_accessed": TODAY,
    },
    # ── S14 Highbush Blueberry ──────────────────────────────────────────────
    {
        "source_id": "S14",
        "plant_name": "Highbush Blueberry (Vaccinium corymbosum)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/b/b9/Vaccinium_corymbosum_Beeren.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Vaccinium_corymbosum_Beeren.jpg",
        "license_name": "CC BY-SA 2.5",
        "license_url": "https://creativecommons.org/licenses/by-sa/2.5/deed.en",
        "author_name": "Sphl",
        "author_url": "https://commons.wikimedia.org/wiki/User:Sphl",
        "date_accessed": TODAY,
    },
    # ── S25 Japanese Quince ─────────────────────────────────────────────────
    {
        "source_id": "S25",
        "plant_name": "Japanese Quince (Chaenomeles japonica)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Bloemen_van_een_Chaenomeles_x_superba_%27nicolina%27_%28chinese_kwee%29._20-04-2021_%28actm.%29_01.jpg/1280px-Bloemen_van_een_Chaenomeles_x_superba_%27nicolina%27_%28chinese_kwee%29._20-04-2021_%28actm.%29_01.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Bloemen_van_een_Chaenomeles_x_superba_%27nicolina%27_(chinese_kwee)._20-04-2021_(actm.)_01.jpg",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Agnieszka Kwiecien Nova",
        "author_url": "https://commons.wikimedia.org/wiki/User:Nova",
        "date_accessed": TODAY,
    },
    # ── T01 Walnut ──────────────────────────────────────────────────────────
    {
        "source_id": "T01",
        "plant_name": "Walnut (Juglans regia)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Walnuts_-_whole_and_open_with_halved_kernel.jpg/1920px-Walnuts_-_whole_and_open_with_halved_kernel.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Walnuts_-_whole_and_open_with_halved_kernel.jpg",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Ivar Leidus",
        "author_url": "https://commons.wikimedia.org/wiki/User:Ivar_Leidus",
        "date_accessed": TODAY,
    },
    # ── T04 Pedunculate Oak ─────────────────────────────────────────────────
    {
        "source_id": "T04",
        "plant_name": "Pedunculate Oak (Quercus robur)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Quercus_robur_acorns_in_Tuntorp_1.jpg/1920px-Quercus_robur_acorns_in_Tuntorp_1.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Quercus_robur_acorns_in_Tuntorp_1.jpg",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Ivar Leidus",
        "author_url": "https://commons.wikimedia.org/wiki/User:Ivar_Leidus",
        "date_accessed": TODAY,
    },
    # ── P01 Grapevine ───────────────────────────────────────────────────────
    {
        "source_id": "P01",
        "plant_name": "Grapevine (Vitis vinifera)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Edle_Weinrebe%2C_%27Vitis_vinifera%27_subsp._%27vinifera.jpg/1920px-Edle_Weinrebe%2C_%27Vitis_vinifera%27_subsp._%27vinifera.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Edle_Weinrebe,_%27Vitis_vinifera%27_subsp._%27vinifera.jpg",
        "license_name": "CC BY 2.0",
        "license_url": "https://creativecommons.org/licenses/by/2.0/deed.en",
        "author_name": "Bohringer Friedrich",
        "author_url": "https://commons.wikimedia.org/wiki/User:Bohringer_Friedrich",
        "date_accessed": TODAY,
    },
    # ── P02 Hardy Kiwi ──────────────────────────────────────────────────────
    {
        "source_id": "P02",
        "plant_name": "Hardy Kiwi (Actinidia arguta)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/0/09/Actinidia_arguta_fruit_-_hardy_kiwi_-_Kiwibeere_05.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Actinidia_arguta_fruit_-_hardy_kiwi_-_Kiwibeere_05.jpg",
        "license_name": "CC BY 3.0",
        "license_url": "https://creativecommons.org/licenses/by/3.0/deed.en",
        "author_name": "Bff",
        "author_url": "https://commons.wikimedia.org/wiki/User:Bff",
        "date_accessed": TODAY,
    },
    # ── P03 Hops ────────────────────────────────────────────────────────────
    {
        "source_id": "P03",
        "plant_name": "Hops (Humulus lupulus)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Humulus_Lupulus_Hopfendolde-mit-hopfengarten.jpg/1920px-Humulus_Lupulus_Hopfendolde-mit-hopfengarten.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Humulus_Lupulus_Hopfendolde-mit-hopfengarten.jpg",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "Ticino-Joern",
        "author_url": "https://commons.wikimedia.org/wiki/User:Ticino-Joern",
        "date_accessed": TODAY,
    },
    # ── P04 Groundnut ───────────────────────────────────────────────────────
    {
        "source_id": "P04",
        "plant_name": "Groundnut (Apios americana)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Groundnut_of_Salem.jpg/960px-Groundnut_of_Salem.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Groundnut_of_Salem.jpg",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Thamizhpparithi Maari",
        "author_url": "https://commons.wikimedia.org/wiki/User:Thamizhpparithi_Maari",
        "date_accessed": TODAY,
    },
    # ── P05 Jerusalem Artichoke ─────────────────────────────────────────────
    {
        "source_id": "P05",
        "plant_name": "Jerusalem Artichoke (Helianthus tuberosus)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Helianthus_tuberosus_Parco_fluviale_alta_Val_d%27Elsa_18.jpg/1920px-Helianthus_tuberosus_Parco_fluviale_alta_Val_d%27Elsa_18.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Helianthus_tuberosus_Parco_fluviale_alta_Val_d%27Elsa_18.jpg",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "Giancarlo Dessi",
        "author_url": "https://commons.wikimedia.org/wiki/User:Giancarlo_Dessi",
        "date_accessed": TODAY,
    },
    # ── P06 Skirret ─────────────────────────────────────────────────────────
    {
        "source_id": "P06",
        "plant_name": "Skirret (Sium sisarum)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Sium_sisarum_JRVdH_01.jpg/1920px-Sium_sisarum_JRVdH_01.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Sium_sisarum_JRVdH_01.jpg",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Jerzy Opiola",
        "author_url": "https://commons.wikimedia.org/wiki/User:Jerzy_Opiola",
        "date_accessed": TODAY,
    },
    # ── P07 Chinese Artichoke ───────────────────────────────────────────────
    {
        "source_id": "P07",
        "plant_name": "Chinese Artichoke (Stachys affinis)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Stachys_sieboldii_2.JPG/960px-Stachys_sieboldii_2.JPG",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Stachys_sieboldii_2.JPG",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Sten Porse",
        "author_url": "https://commons.wikimedia.org/wiki/User:Sten",
        "date_accessed": TODAY,
    },
    # ── P08 Asparagus ───────────────────────────────────────────────────────
    {
        "source_id": "P08",
        "plant_name": "Asparagus (Asparagus officinalis)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Asparagus_officinalis_Muromets3.JPG/960px-Asparagus_officinalis_Muromets3.JPG",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Asparagus_officinalis_Muromets3.JPG",
        "license_name": "CC0 1.0",
        "license_url": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "author_name": "Lazaregagnidze",
        "author_url": "https://commons.wikimedia.org/wiki/User:Lazaregagnidze",
        "date_accessed": TODAY,
    },
    # ── P09 Rhubarb ─────────────────────────────────────────────────────────
    {
        "source_id": "P09",
        "plant_name": "Rhubarb (Rheum x hybridum)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/4/49/Rheum_rhabarbarum_sprouting_001.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Rheum_rhabarbarum_sprouting_001.jpg",
        "license_name": "Public Domain",
        "license_url": "https://en.wikipedia.org/wiki/Public_domain",
        "author_name": "Rasbak",
        "author_url": "https://commons.wikimedia.org/wiki/User:Rasbak",
        "date_accessed": TODAY,
    },
    # ── P10 Perennial Kale ──────────────────────────────────────────────────
    {
        "source_id": "P10",
        "plant_name": "Perennial Kale (Brassica oleracea)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Heuchera_%27Kale_Beauty%27_02.JPG/960px-Heuchera_%27Kale_Beauty%27_02.JPG",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Heuchera_%27Kale_Beauty%27_02.JPG",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "Acabashi",
        "author_url": "https://commons.wikimedia.org/wiki/User:Acabashi",
        "date_accessed": TODAY,
    },
    # ── P13 Welsh Onion ─────────────────────────────────────────────────────
    {
        "source_id": "P13",
        "plant_name": "Welsh Onion (Allium fistulosum)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/f/fb/Sint_Jansui_half_may_%28Allium_fistulosum_var._bulbifera%29.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Sint_Jansui_half_may_(Allium_fistulosum_var._bulbifera).jpg",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "Rasbak",
        "author_url": "https://commons.wikimedia.org/wiki/User:Rasbak",
        "date_accessed": TODAY,
    },
    # ── P18 White Clover ────────────────────────────────────────────────────
    {
        "source_id": "P18",
        "plant_name": "White Clover (Trifolium repens)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Trifolium_repens_%28inflorescense%29_Edit.jpg/960px-Trifolium_repens_%28inflorescense%29_Edit.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Trifolium_repens_(inflorescense)_Edit.jpg",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "Olivier Pichard",
        "author_url": "https://commons.wikimedia.org/wiki/User:Olivier_Pichard",
        "date_accessed": TODAY,
    },
    # ── P19 Red Clover ──────────────────────────────────────────────────────
    {
        "source_id": "P19",
        "plant_name": "Red Clover (Trifolium pratense)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Trifolium_pratense_-_Keila.jpg/1280px-Trifolium_pratense_-_Keila.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Trifolium_pratense_-_Keila.jpg",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Ivar Leidus",
        "author_url": "https://commons.wikimedia.org/wiki/User:Ivar_Leidus",
        "date_accessed": TODAY,
    },
    # ── P21 Yarrow ──────────────────────────────────────────────────────────
    {
        "source_id": "P21",
        "plant_name": "Yarrow (Achillea millefolium)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Yarrow_%28Achillea_millefolium%29.jpg/1280px-Yarrow_%28Achillea_millefolium%29.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Yarrow_(Achillea_millefolium).jpg",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Kristian Peters",
        "author_url": "https://commons.wikimedia.org/wiki/User:Kristian_Peters",
        "date_accessed": TODAY,
    },
    # ── P22 Strawberry ──────────────────────────────────────────────────────
    {
        "source_id": "P22",
        "plant_name": "Strawberry (Fragaria x ananassa)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Erdbeere_IMG_8052.jpg/960px-Erdbeere_IMG_8052.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Erdbeere_IMG_8052.jpg",
        "license_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        "author_name": "Bohringer Friedrich",
        "author_url": "https://commons.wikimedia.org/wiki/User:Bohringer_Friedrich",
        "date_accessed": TODAY,
    },
    # ── P33 Daylily ─────────────────────────────────────────────────────────
    {
        "source_id": "P33",
        "plant_name": "Daylily (Hemerocallis fulva)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Hemerocallis_fulva_2018_G1.jpg/1920px-Hemerocallis_fulva_2018_G1.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Hemerocallis_fulva_2018_G1.jpg",
        "license_name": "Public Domain",
        "license_url": "https://en.wikipedia.org/wiki/Public_domain",
        "author_name": "Krzysztof Ziarnek",
        "author_url": "https://commons.wikimedia.org/wiki/User:Kenraiz",
        "date_accessed": TODAY,
    },
    # ── P37 Chicory ─────────────────────────────────────────────────────────
    {
        "source_id": "P37",
        "plant_name": "Chicory (Cichorium intybus)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cichorium_intybus-alvesgaspar1.jpg/1920px-Cichorium_intybus-alvesgaspar1.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Cichorium_intybus-alvesgaspar1.jpg",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "Alvesgaspar",
        "author_url": "https://commons.wikimedia.org/wiki/User:Alvesgaspar",
        "date_accessed": TODAY,
    },
    # ── P41 Lotus ───────────────────────────────────────────────────────────
    {
        "source_id": "P41",
        "plant_name": "Lotus (Nelumbo nucifera)",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Nelumno_nucifera_open_flower_-_botanic_garden_adelaide2.jpg/1920px-Nelumno_nucifera_open_flower_-_botanic_garden_adelaide2.jpg",
        "source_page_url": "https://commons.wikimedia.org/wiki/File:Nelumno_nucifera_open_flower_-_botanic_garden_adelaide2.jpg",
        "license_name": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/deed.en",
        "author_name": "Wyndham",
        "author_url": "https://commons.wikimedia.org/wiki/User:Wyndham",
        "date_accessed": TODAY,
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_col():
    client = MongoClient(MONGO_URI)
    return client, client[MONGO_DB][IMAGES_COLLECTION]


def _serialize(doc: dict) -> dict:
    """Strip MongoDB _id before returning to client."""
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@plant_images_bp.post("/api/plant-images/seed")
def seed_plant_images():
    """
    Upsert the seed image records into MongoDB.
    Call once (or again after adding new entries to SEED_IMAGES).
    Skips records with empty source_id or PENDING placeholders if
    ?skip_pending=true is passed.
    """
    skip_pending = request.args.get("skip_pending", "false").lower() == "true"

    client, col = _get_col()
    try:
        ops = []
        for record in SEED_IMAGES:
            sid = record.get("source_id", "")
            if skip_pending and (not sid or sid.startswith("__PENDING")):
                continue
            ops.append(
                UpdateOne(
                    {"source_id": sid},
                    {"$set": record},
                    upsert=True,
                )
            )

        result = col.bulk_write(ops, ordered=False) if ops else None
        return jsonify(
            {
                "status": "ok",
                "upserted": result.upserted_count if result else 0,
                "modified": result.modified_count if result else 0,
                "total_seed_records": len(SEED_IMAGES),
            }
        )
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500
    finally:
        client.close()


@plant_images_bp.get("/api/plant-images")
def list_plant_images():
    """Return all image records (excludes PENDING placeholders by default)."""
    include_pending = request.args.get("include_pending", "false").lower() == "true"

    client, col = _get_col()
    try:
        query: dict = {}
        if not include_pending:
            query["source_id"] = {"$not": {"$regex": "^__PENDING"}}
            query["image_url"] = {"$ne": ""}

        docs = [_serialize(d) for d in col.find(query, {"_id": 0})]
        return jsonify({"status": "ok", "count": len(docs), "images": docs})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500
    finally:
        client.close()


@plant_images_bp.get("/api/plant-images/<source_id>")
def get_plant_image(source_id: str):
    """Return the image record for a single plant by source_id (e.g. S01)."""
    client, col = _get_col()
    try:
        doc = col.find_one({"source_id": source_id.upper()}, {"_id": 0})
        if not doc:
            return jsonify({"status": "not_found", "source_id": source_id}), 404
        return jsonify({"status": "ok", "image": _serialize(doc)})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500
    finally:
        client.close()


@plant_images_bp.put("/api/plant-images/<source_id>")
def upsert_plant_image(source_id: str):
    """
    Add or update an image record for a plant.
    Required body fields: image_url, source_page_url, license_name,
                          license_url, author_name
    Optional: author_url, plant_name
    """
    REQUIRED = ["image_url", "source_page_url", "license_name", "license_url", "author_name"]

    payload = request.get_json(silent=True) or {}
    missing = [f for f in REQUIRED if not payload.get(f)]
    if missing:
        return jsonify(
            {"status": "error", "error": f"Missing required fields: {missing}"}
        ), 400

    record = {
        "source_id": source_id.upper(),
        "plant_name": payload.get("plant_name", ""),
        "image_url": payload["image_url"],
        "source_page_url": payload["source_page_url"],
        "license_name": payload["license_name"],
        "license_url": payload["license_url"],
        "author_name": payload["author_name"],
        "author_url": payload.get("author_url", ""),
        "date_accessed": payload.get("date_accessed", TODAY),
    }

    client, col = _get_col()
    try:
        col.update_one(
            {"source_id": source_id.upper()},
            {"$set": record},
            upsert=True,
        )
        return jsonify({"status": "ok", "source_id": source_id.upper(), "record": record})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500
    finally:
        client.close()


@plant_images_bp.delete("/api/plant-images/<source_id>")
def delete_plant_image(source_id: str):
    """Remove the image record for a plant."""
    client, col = _get_col()
    try:
        result = col.delete_one({"source_id": source_id.upper()})
        if result.deleted_count == 0:
            return jsonify({"status": "not_found", "source_id": source_id}), 404
        return jsonify({"status": "ok", "deleted": source_id.upper()})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500
    finally:
        client.close()