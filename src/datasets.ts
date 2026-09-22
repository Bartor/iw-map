import type { Country, Data, DatasetInfo, Dim } from "./types";
import { regionOf } from "./regions";

// Raw JSON shapes produced by the research step (data/*.json)
interface HofRaw {
  meta: { sources: string[]; notes?: string };
  countries: Array<{ iso3: string | null; name: string; pdi: number | null; idv: number | null; mas: number | null; uai: number | null; lto: number | null; ivr: number | null; source?: string }>;
}
interface IwRaw {
  meta: { sources: string[]; notes?: string };
  editions: Array<{ id: string; label: string; source?: string; approximate?: boolean; countries: Array<{ iso3: string | null; name: string; trad_sec: number | null; surv_self: number | null }> }>;
}

const HOF_DIMS: Array<[keyof HofRaw["countries"][number], string, string, string, string]> = [
  ["pdi", "Power Distance", "PDI", "low power distance", "high power distance"],
  ["idv", "Individualism", "IDV", "collectivist", "individualist"],
  ["mas", "Motivation towards Achievement (Masculinity)", "MAS", "consensus / feminine", "achievement / masculine"],
  ["uai", "Uncertainty Avoidance", "UAI", "low avoidance", "high avoidance"],
  ["lto", "Long Term Orientation", "LTO", "short-term", "long-term"],
  ["ivr", "Indulgence", "IVR", "restraint", "indulgence"],
];

function niceRange(values: number[]): [number, number] {
  let min = Math.min(...values), max = Math.max(...values);
  const pad = (max - min) * 0.08;
  min = Math.floor((min - pad) * 2) / 2;
  max = Math.ceil((max + pad) * 2) / 2;
  return [min, max];
}

export async function loadData(): Promise<Data> {
  const files = import.meta.glob("../data/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
  const iw = files["../data/inglehart_welzel.json"] as IwRaw | undefined;

  const dims: Dim[] = [];
  const datasets: DatasetInfo[] = [];
  const countries = new Map<string, Country>();
  const getCountry = (iso3: string, name: string) => {
    iso3 = iso3.toUpperCase();
    let c = countries.get(iso3);
    if (!c) {
      c = { iso3, name, region: regionOf(iso3), values: {} };
      countries.set(iso3, c);
    }
    return c;
  };

  // Hofstede editions: data/hofstede.json (2015 matrix, gap-filled) plus any data/hofstede_<edition>.json
  const HOF_EDITIONS: Array<{ file: string; id: string; short: string; label: string }> = [
    { file: "../data/hofstede.json", id: "hof", short: "2015", label: "Hofstede · 2015 matrix" },
    { file: "../data/hofstede_2023.json", id: "hof2023", short: "2023", label: "Hofstede · Culture Factor 2023" },
  ];
  const presentEditions = HOF_EDITIONS.filter((e) => files[e.file]);
  for (const ed of presentEditions) {
    const raw = files[ed.file] as HofRaw;
    const multi = presentEditions.length > 1;
    datasets.push({ id: ed.id, label: multi ? ed.label : "Hofstede (6-D)", sources: raw.meta.sources, notes: raw.meta.notes });
    for (const [key, label, short, lo, hi] of HOF_DIMS) {
      dims.push({
        id: ed.id + "." + key, dataset: ed.id, datasetLabel: multi ? ed.label : "Hofstede",
        label: multi ? label + " (" + ed.short + ")" : label, short: multi ? short + " " + ed.short : short,
        min: 0, max: 100, lowLabel: lo, highLabel: hi,
      });
    }
    for (const row of raw.countries) {
      const c = getCountry(row.iso3 ?? "_" + row.name.replace(/[^a-z0-9]+/gi, "_").toUpperCase(), row.name);
      for (const [key] of HOF_DIMS) {
        const v = row[key];
        if (typeof v === "number" && Number.isFinite(v)) c.values[ed.id + "." + key] = v;
      }
    }
  }

  if (iw) {
    datasets.push({ id: "iw", label: "Inglehart–Welzel", sources: iw.meta.sources, notes: iw.meta.notes });
    const allTS: number[] = [], allSS: number[] = [];
    for (const ed of iw.editions) for (const c of ed.countries) {
      if (typeof c.trad_sec === "number") allTS.push(c.trad_sec);
      if (typeof c.surv_self === "number") allSS.push(c.surv_self);
    }
    const [tsMin, tsMax] = allTS.length ? niceRange(allTS) : [-2.5, 2.5];
    const [ssMin, ssMax] = allSS.length ? niceRange(allSS) : [-2.5, 2.5];
    const SHORT: Record<string, string> = {
      wvs_official_2022_map: "2022 map", wvs2023_latest_per_country: "2023 map (latest per country)",
      wvs_wave7_2017_2022: "Wave 7 (2017–22)", wvs_wave6_2010_2014: "Wave 6 (2010–14)", wvs_wave5_2005_2009: "Wave 5 (2005–09)",
    };
    for (const ed of iw.editions) {
      if (!(ed.id in SHORT)) continue; // skip raw multi-row country-year table
      const label = SHORT[ed.id];
      const tag = ed.approximate ? " (approx.)" : "";
      dims.push({ id: `iw.${ed.id}.trad_sec`, dataset: "iw", datasetLabel: `Inglehart–Welzel · ${label}`, label: `Traditional vs Secular-rational — ${label}${tag}`, short: `Trad.→Secular (${label})`, min: tsMin, max: tsMax, lowLabel: "traditional", highLabel: "secular-rational" });
      dims.push({ id: `iw.${ed.id}.surv_self`, dataset: "iw", datasetLabel: `Inglehart–Welzel · ${label}`, label: `Survival vs Self-expression — ${label}${tag}`, short: `Survival→Self-expr. (${label})`, min: ssMin, max: ssMax, lowLabel: "survival", highLabel: "self-expression" });
      for (const row of ed.countries) {
        const c = getCountry(row.iso3 ?? "_" + row.name.replace(/[^a-z0-9]+/gi, "_").toUpperCase(), row.name);
        if (typeof row.trad_sec === "number") c.values[`iw.${ed.id}.trad_sec`] = row.trad_sec;
        if (typeof row.surv_self === "number") c.values[`iw.${ed.id}.surv_self`] = row.surv_self;
      }
    }
  }

  const list = [...countries.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { dims, countries: list, datasets };
}
