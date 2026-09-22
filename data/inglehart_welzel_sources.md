# Inglehart–Welzel Cultural Map data — sources and coverage

## Output
`data/inglehart_welzel.json` — 6 editions, all built from real numbers pulled directly
from official World Values Survey Association (WVS) downloadable data files. No values
were eyeballed/estimated from map images.

## What worked

### 1. worldvaluessurvey.org official downloadable data files (primary, successful)
The WVS "Findings & Insights" cultural-map news posts link to Excel files behind a
JavaScript `DOCDownload('<id>')` handler that POSTs to `AJDownload.jsp` with a `DOID`
form field and streams the file back (it is not a plain static URL, so `curl` alone
couldn't fetch it — a session/referrer-bound POST from the actual WVS page was needed).
This was done via a real browser session (loaded worldvaluessurvey.org, then issued the
authenticated `fetch()` POST from within that page's origin), and the resulting arraybuffer
was parsed client-side with SheetJS (`XLSX.js` from cdnjs) to avoid any lossy transcription.

Files successfully retrieved and parsed:

- **`CulturalMapFinalEVSWVS_2023.xlsx`** (DOID 16619), linked from
  https://www.worldvaluessurvey.org/WVSNewsShow.jsp?ID=467 ("WVS Cultural Map: 2023
  Version Released"). Contains **413 country-survey-year observations** (`TradAgg`,
  `SurvSAgg` columns) spanning WVS/EVS waves 1–7, 1981–2022, for every country ever
  surveyed. This is the authoritative underlying data behind the 2023 map graphic.
  Also included two Welzel emancipative-values columns (`Y010`, `Y020`) which were not
  used here but are available in the sheet if needed later.

- **`Cultural_Map_scores_2022.xls`** (DOID 12222), linked from
  https://www.worldvaluessurvey.org/WVSNewsShow.jsp?ID=428 ("WVS Cultural Map: 2022
  version released" / "World Values Survey Association" news post). Contains **110
  countries**, one Traditional/Secular-rational and one Survival/Self-expression score
  per country — this is the exact one-point-per-country dataset WVS used for their
  published 2022 map image.

### Editions produced from the above
1. `wvs_official_2022_map` (110 countries) — official 2022 map, used as-is.
2. `wvs2023_latest_per_country` (116 countries) — from the 2023 raw file, most recent
   survey year kept per country (closest analogue to "the current/2023 map").
3. `wvs_wave7_2017_2022` (90 countries) — average of all 2017–2022 observations per
   country, from the 2023 raw file.
4. `wvs_wave6_2010_2014` (55 countries) — average of 2010–2014 observations.
5. `wvs_wave5_2005_2009` (73 countries) — average of 2005–2009 observations.
6. `wvs2023_country_year_raw` (413 rows) — the full unaggregated country-year dataset,
   with a `year` field, for anyone who wants to do their own wave grouping or animate
   change over time.

All countries mapped cleanly to ISO 3166-1 alpha-3 codes (Kosovo → XKX, Northern
Ireland kept as a UK sub-unit `GBR-NIR` since WVS treats it as a separate row from
Great Britain, Taiwan → TWN, Hong Kong/Macau SAR → HKG/MAC).

## What did not pan out

- **`WVS_Wave_1_to_6_Key_Aggregates.zip`** (DOID 6567, linked from
  https://www.worldvaluessurvey.org/WVSNewsShow.jsp?ID=367). Downloaded fine, but it
  unzips to a single SPSS `.sav` file (`WVS Wave 1 to 6 Key Aggregates.sav`), which
  can't be parsed with the in-browser JS toolchain used here (no SPSS reader on hand).
  Not used. If earlier per-wave official aggregates are needed, this file would need to
  be opened in SPSS/`pyreadstat`/R `haven` separately — the derived wave5/wave6/wave7
  editions above (averaged from the 2023 country-year file) are a reasonable
  substitute in the meantime.

- **GitHub repo `Shavvimal/model_cultural_comp`**: refits its own PPCA-based cultural
  map from the raw Integrated Values Survey, but explicitly does not commit any
  data/CSV files to the repo ("No datasets, generated results... belong in Git") —
  everything is generated locally during their reproduction pipeline. No usable
  coordinates file found.

- **Wikipedia "Inglehart–Welzel cultural map of the world"**: describes the map and
  links back to worldvaluessurvey.org for current data, but has no coordinate table or
  machine-readable source itself (the Commons SVG is a hand-drawn illustration, not
  data-driven).

- **Inglehart & Welzel 2005 book appendix / "Freedom Rising" data / academic PDFs**:
  not directly fetched in this pass — the official WVS xlsx files turned out to be a
  much higher-fidelity and more complete source (exact figures WVS itself published),
  so this avenue wasn't pursued further given time constraints.

## Coverage summary

| Edition | Countries | Source file |
|---|---|---|
| wvs_official_2022_map | 110 | Cultural_Map_scores_2022.xls |
| wvs2023_latest_per_country | 116 | CulturalMapFinalEVSWVS_2023.xlsx (latest year/country) |
| wvs_wave7_2017_2022 | 90 | CulturalMapFinalEVSWVS_2023.xlsx (2017–2022 avg) |
| wvs_wave6_2010_2014 | 55 | CulturalMapFinalEVSWVS_2023.xlsx (2010–2014 avg) |
| wvs_wave5_2005_2009 | 73 | CulturalMapFinalEVSWVS_2023.xlsx (2005–2009 avg) |
| wvs2023_country_year_raw | 413 rows / ~110 countries | CulturalMapFinalEVSWVS_2023.xlsx (raw) |
