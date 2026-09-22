export const REGION_COLORS: Record<string, number> = {
  "Northern Europe": 0xa5f3fc,               // ice
  "Western Europe": 0x4263eb,                // royal blue
  "Southern Europe": 0x12b886,               // Mediterranean green
  "Central & Eastern Europe": 0x9775fa,      // violet
  "Eastern Europe & Central Asia": 0xe64980, // raspberry
  "Middle East & North Africa": 0xffd43b,    // desert gold
  "Sub-Saharan Africa": 0xc2410c,            // earth
  "South & Southeast Asia": 0x84cc16,        // jungle lime
  "East Asia": 0xef4444,                     // red
  "Latin America & Caribbean": 0xff922b,     // orange
  "North America": 0xf1f3f5,                 // white
  "Oceania": 0x38bdf8,                       // sky
  "Other": 0x6b7280,                         // grey
};

export const REGION_ORDER = Object.keys(REGION_COLORS);

const R: Record<string, string[]> = {
  // UN geoscheme, with the UK and Ireland grouped with Western Europe
  "Northern Europe": ["DNK","EST","FIN","ISL","LVA","LTU","NOR","SWE"],
  "Western Europe": ["AUT","BEL","FRA","DEU","DDR","IRL","LIE","LUX","MCO","NLD","CHE","GBR"],
  "Southern Europe": ["ALB","AND","BIH","HRV","CYP","GRC","ITA","XKX","MLT","MNE","MKD","PRT","SMR","SRB","SVN","ESP","VAT"],
  "Central & Eastern Europe": ["BGR","CZE","HUN","MDA","POL","ROU","SVK"],
  "Eastern Europe & Central Asia": ["ARM","AZE","BLR","GEO","KAZ","KGZ","RUS","TJK","TKM","UKR","UZB"],
  "Middle East & North Africa": ["DZA","BHR","EGY","IRN","IRQ","ISR","JOR","KWT","LBN","LBY","MAR","OMN","PSE","QAT","SAU","SYR","TUN","TUR","ARE","YEM"],
  "Sub-Saharan Africa": ["AGO","BEN","BWA","BFA","BDI","CMR","CPV","CAF","TCD","COM","COG","COD","CIV","DJI","GNQ","ERI","SWZ","ETH","GAB","GMB","GHA","GIN","GNB","KEN","LSO","LBR","MDG","MWI","MLI","MRT","MUS","MOZ","NAM","NER","NGA","RWA","STP","SEN","SYC","SLE","SOM","ZAF","SSD","SDN","TZA","TGO","UGA","ZMB","ZWE"],
  "South & Southeast Asia": ["AFG","BGD","BTN","BRN","KHM","IND","IDN","LAO","MYS","MDV","MMR","NPL","PAK","PHL","SGP","LKA","THA","TLS","VNM"],
  "East Asia": ["CHN","HKG","JPN","PRK","KOR","MAC","MNG","TWN"],
  "Latin America & Caribbean": ["ATG","ARG","BHS","BRB","BLZ","BOL","BRA","CHL","COL","CRI","CUB","DMA","DOM","ECU","SLV","GRD","GTM","GUY","HTI","HND","JAM","MEX","NIC","PAN","PRY","PER","PRI","KNA","LCA","VCT","SUR","TTO","URY","VEN"],
  "North America": ["CAN","USA","BMU","GRL"],
  "Oceania": ["AUS","FJI","KIR","MHL","FSM","NRU","NZL","PLW","PNG","WSM","SLB","TON","TUV","VUT"],
};

const LOOKUP = new Map<string, string>();
for (const [region, codes] of Object.entries(R)) for (const c of codes) LOOKUP.set(c, region);

export function regionOf(iso3: string): string {
  return LOOKUP.get(iso3.toUpperCase()) ?? "Other";
}
