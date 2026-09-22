export const REGION_COLORS: Record<string, number> = {
  "Europe": 0x6ea8fe,
  "Eastern Europe & Central Asia": 0xb28dff,
  "Middle East & North Africa": 0xffb86b,
  "Sub-Saharan Africa": 0xff7b72,
  "South & Southeast Asia": 0x3fd0a8,
  "East Asia": 0xf2c94c,
  "Latin America & Caribbean": 0xff79c6,
  "North America": 0x8be9fd,
  "Oceania": 0x50fa7b,
  "Other": 0x9aa4b2,
};

export const REGION_ORDER = Object.keys(REGION_COLORS);

const R: Record<string, string[]> = {
  "Europe": ["ALB","AND","AUT","BEL","BIH","BGR","HRV","CYP","CZE","DNK","EST","FIN","FRA","DEU","GRC","HUN","ISL","IRL","ITA","XKX","LVA","LIE","LTU","LUX","MLT","MDA","MCO","MNE","NLD","MKD","NOR","POL","PRT","ROU","SMR","SRB","SVK","SVN","ESP","SWE","CHE","GBR","VAT","DDR"],
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
