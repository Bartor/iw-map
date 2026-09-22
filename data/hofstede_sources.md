# Hofstede cultural dimension scores — data collection summary

Generated: 2026-09-22

## Output
`data/hofstede.json` — 136 entries total (126 with an ISO 3166-1 alpha-3 code, 10 regional/
sub-national aggregates left with `iso3: null`), 103 entries with all six dimensions filled.

## Sources tried

### 1. geerthofstede.com official "Dimension data matrix" — SUCCESS
- Page: https://geerthofstede.com/research-and-vsm/dimension-data-matrix/
- File fetched directly via curl:
  https://geerthofstede.com/wp-content/uploads/2016/08/6-dimensions-for-website-2015-08-16.csv
  (the "standard version", allowing values outside 0-100 for replication-study outliers; the
  file dated 2015-08-16 was the one actually served under that filename — this is the
  canonical Hofstede/Hofstede/Minkov "Cultures and Organizations" appendix table plus later
  VSM/WVS long-term-orientation updates).
- 111 data rows: 6 dimensions are `pdi;idv;mas;uai;ltowvs;ivr`. Many countries only have
  `ltowvs`/`ivr` populated (from the separate World Values Survey-based LTO/IVR study) with
  `pdi/idv/mas/uai` marked `#NULL!` — this is expected; those four dimensions come from the
  original IBM survey which covered far fewer countries.
- Used as the BASE dataset (added first, so its values are never overwritten by other sources).

### 2. GitHub mirrors of the CSV — found candidates, not needed
Search surfaced several GitHub/Kaggle mirrors (not fetched, since the official file downloaded
successfully directly):
- https://github.com/isamathr/hofstede-cultural-dimensions/blob/main/HofstedeData.csv
- https://github.com/plotly/datasets/blob/master/hofstede-cultural-dimensions.csv
- https://raw.githubusercontent.com/masterfloss/data/refs/heads/main/culture2015.csv
- https://gist.github.com/dlwjiang/6d4d32c8c77c9de7be2e
- Kaggle: tarukofusuki/hofstedes-6d-model-of-national-culture, seydakaba/hofstede-cultural-dimensions-by-country,
  aleksakenjic/hofstedes-cultural-dimensions (not fetched — requires login).

### 3. hofstede-insights.com / theculturefactor.com Country Comparison Tool — SUCCESS
- Tool page: https://www.theculturefactor.com/country-comparison-tool
  (hofstede-insights.com now redirects to theculturefactor.com).
- The tool renders ALL country data server-side into the HTML (each country in a
  `<div class="c-overview" data-country="...">` block with `<span class="power-distance|
  individualism|motivation|uncertainty-avoidance|long-term-orientation|indulgence">value</span>`
  elements) rather than via a separate JSON API — confirmed by inspecting the page's loaded
  script `module_Country_Comparison.js`, which reads values straight out of the DOM
  (`$('.c-overview__value span')`) instead of fetching them. So a single `curl` of the tool
  page plus a small Node.js regex parser extracted all 119 countries/regions in one pass.
- Note: this source uses the 2023-renamed label "Motivation towards Achievement and Success"
  for the dimension that maps 1:1 onto the classic Masculinity (MAS) index — mapped to `mas`
  in the output.
- Used to FILL IN dimensions missing from the official 2015 matrix (e.g. Albania, Algeria,
  Angola, Armenia and ~20 other countries that only had lto/ivr in the 2015 file now have
  full pdi/idv/mas/uai from this 2023-era source), and to add countries entirely absent from
  the 2015 matrix (e.g. Bhutan, Cape Verde, Fiji, Honduras, Kazakhstan, Kenya, Kuwait, Lebanon,
  Libya, Malawi, Mozambique, Namibia, Nepal, Paraguay, Qatar, Senegal, Sierra Leone, Sri Lanka,
  Syria, Tunisia, UAE).

### 4. Wikipedia "Hofstede's cultural dimensions theory" — NOT fetched
Not needed once the two structured sources above gave 136 entries; Wikipedia's tables are
themselves derived from the same Hofstede book/matrix already captured in source #1.

### 5. Minkov & Kaasa (2022) "Do we need a new set of dimensions..." — NOT fetched
Searched for but not retrieved as a numeric per-country table; the theculturefactor.com tool
(source #3) already reflects the Culture Factor Group / Minkov 2023 update for the countries
it covers, so this paper's contribution is effectively already folded in via source #3.

## Merge logic
For each dimension of each country, the official 2015 Hofstede matrix (source #1) value is
kept if present; theculturefactor.com (source #3) only supplies a value when the matrix has
none. The `source` field on each country entry in `hofstede.json` lists which source(s)
actually contributed at least one of its six scores (pipe-separated when both contributed).

## Known limitations / non-ISO3 entries
10 entries from the 2015 matrix are regional aggregates or sub-national splits without a
single ISO 3166-1 alpha-3 code and are kept with `iso3: null`:
Africa East, Africa West, Arab countries, Belgium French, Belgium Netherl(ands), Canada French,
Germany East, South Africa white, Switzerland French, Switzerland German.

## Counts
- Total entries: 136
- Entries with ISO3 code: 126
- Entries with all 6 dimensions (pdi/idv/mas/uai/lto/ivr) present: 103
- Entries with at least one dimension present: 136 (by construction — only such rows were kept)

## 2023 edition

Re-fetched the theculturefactor.com Country Comparison Tool separately (not merged into
`hofstede.json`) so the 2023-era values could be inspected in isolation, per a follow-up
request. Output: `data/hofstede_2023.json`, same schema as `hofstede.json`.

- Fetched with `curl -s -A "Mozilla/5.0 ..." https://www.theculturefactor.com/country-comparison-tool`
  on 2026-09-22 — HTTP 200, ~1.49 MB HTML. No fallback to hofstede-insights.com was needed.
- Parsed with a Node.js regex script reading each `<div class="c-overview" data-country="...">`
  block: country name from the `<h4>`, and the six dimension values from
  `<span class="power-distance|individualism|motivation|uncertainty-avoidance|
  long-term-orientation|indulgence">value</span>`. `motivation` (2023's renamed label for
  Masculinity) mapped to `mas`, same as before.
- This fetch returned **119** country/region blocks — the same count as before, but this time
  with **no regional aggregate** ("Arab countries" etc. did not appear); all 119 are named,
  ISO-3166-mappable countries. Every one was matched to an existing `iso3`/`name` pair already
  present in `data/hofstede.json` by country name (accounting for the tool's own naming
  differences, e.g. "South korea" → Korea South/KOR, "United kingdom" → Great Britain/GBR,
  "Czech republic" → Czech Rep/CZE, "North macedonia" → Macedonia Rep/MKD, "Bosnia and
  herzegovina" → Bosnia/BIH, "United states" → U.S.A./USA). No unmatched names; `iso3` is
  non-null for all 119 entries in `hofstede_2023.json`.
- `hofstede_2023.json` is standalone: it is NOT merged with the 2015 official Hofstede matrix,
  and no values were fabricated or backfilled — only what the page actually rendered is
  recorded (all 119 entries have all six dimensions present in this fetch).
- Comparison against the 2015-primary `data/hofstede.json`: of the 119 countries, **81** have
  at least one dimension that differs from the corresponding `hofstede.json` value (148
  individual dimension-level differences total, out of 119 × 6 = 714 possible comparisons).
  Per-dimension diff counts (out of 119): pdi 2, idv 61, mas 1, uai 4, lto 77, ivr 3. The
  differences are concentrated in `idv` and especially `lto` — consistent with `lto` in
  `hofstede.json` coming from the older Hofstede-file `ltowvs` column while this 2023 fetch
  reflects the Culture Factor Group's own updated figures; `pdi`, `uai`, `mas` and `ivr` are
  mostly unchanged between the two sources, with only a handful of small revisions each.
