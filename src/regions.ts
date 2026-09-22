export const REGION_COLORS: Record<string, number> = {
  "Northern Europe": 0x74c0fc,
  "Western Europe": 0x4c6ef5,
  "Southern Europe": 0x22b8cf,
  "Central & Eastern Europe": 0x845ef7,
  "Eastern Europe & Central Asia": 0xbe4bdb,
  "Middle East & North Africa": 0xe8590c,
  "Sub-Saharan Africa": 0xfa5252,
  "South & Southeast Asia": 0x20c997,
  "East Asia": 0xfcc419,
  "Latin America & Caribbean": 0xf06595,
  "North America": 0xc0eb75,
  "Oceania": 0xffa94d,
  "Other": 0x868e96,
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
