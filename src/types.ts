export interface Dim {
  id: string;          // unique across datasets, e.g. "hof.pdi"
  dataset: string;     // dataset id
  datasetLabel: string;
  label: string;       // long label
  short: string;       // short label for axis
  min: number;
  max: number;
  lowLabel?: string;
  highLabel?: string;
  /** For dimensions with several editions: edition id -> key in Country.values */
  editionKeys?: Record<string, string>;
}

export type Edition = "2015" | "2023";

export interface Country {
  iso3: string;
  name: string;
  region: string;
  values: Record<string, number>; // dimId -> value
}

export interface DatasetInfo {
  id: string;
  label: string;
  sources: string[];
  notes?: string;
}

export interface Data {
  dims: Dim[];
  countries: Country[];
  datasets: DatasetInfo[];
  /** Hofstede edition ids available (e.g. ["2015","2023"]) */
  hofEditions: string[];
}
