import type { Country, Data, Dim } from "./types";
import { REGION_COLORS, REGION_ORDER } from "./regions";

export interface UIState {
  axes: (Dim | null)[];
  selection: Set<string>;
  labels: boolean;
  autoRotate: boolean;
}

export interface UICallbacks {
  onAxes(axes: (Dim | null)[]): void;
  onSelection(sel: Set<string>): void;
  onLabels(on: boolean): void;
  onAutoRotate(on: boolean): void;
  onResetView(): void;
  onFocus(iso3s: Set<string> | null): void;
  onHeatmap(on: boolean): void;
  onHeatSpread(t: number): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function readHashAxes(dims: Dim[]): (Dim | null)[] | null {
  const m = location.hash.match(/axes=([^&]*)/);
  if (!m) return null;
  const ids = decodeURIComponent(m[1]).split(",");
  const found = ids.map((id) => dims.find((d) => d.id === id) ?? null);
  return found[0] ? [found[0], found[1] ?? null, found[1] ? found[2] ?? null : null] : null;
}

export function buildUI(data: Data, cb: UICallbacks): UIState {
  const dims = data.dims;
  const selects = [$<HTMLSelectElement>("axis-x"), $<HTMLSelectElement>("axis-y"), $<HTMLSelectElement>("axis-z")];

  // --- axis selects ---
  const groups = new Map<string, Dim[]>();
  for (const d of dims) (groups.get(d.datasetLabel) ?? groups.set(d.datasetLabel, []).get(d.datasetLabel)!).push(d);
  selects.forEach((sel, i) => {
    if (i > 0) {
      const none = document.createElement("option");
      none.value = ""; none.textContent = "— none —";
      sel.appendChild(none);
    }
    for (const [label, ds] of groups) {
      const og = document.createElement("optgroup");
      og.label = label;
      for (const d of ds) {
        const o = document.createElement("option");
        o.value = d.id; o.textContent = d.label;
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
  });

  const defaults = readHashAxes(dims) ?? [
    dims.find((d) => d.id === "hof.pdi") ?? dims[0] ?? null,
    dims.find((d) => d.id === "hof.idv") ?? dims[1] ?? null,
    null,
  ];
  const state: UIState = { axes: defaults, selection: new Set(data.countries.map((c) => c.iso3)), labels: true, autoRotate: false };
  selects.forEach((sel, i) => { sel.value = state.axes[i]?.id ?? ""; });

  const syncAxes = () => {
    const picked = selects.map((s) => dims.find((d) => d.id === s.value) ?? null);
    if (!picked[1]) picked[2] = null;
    state.axes = picked;
    selects[2].disabled = !picked[1];
    if (!picked[1]) selects[2].value = "";
    history.replaceState(null, "", "#axes=" + encodeURIComponent(picked.filter(Boolean).map((d) => d!.id).join(",")));
    cb.onAxes(picked);
    refreshRows();
  };
  selects.forEach((s) => s.addEventListener("change", syncAxes));
  selects[2].disabled = !state.axes[1];

  // --- options ---
  $<HTMLInputElement>("opt-labels").addEventListener("change", (e) => { state.labels = (e.target as HTMLInputElement).checked; cb.onLabels(state.labels); });
  $<HTMLInputElement>("opt-autorotate").addEventListener("change", (e) => { state.autoRotate = (e.target as HTMLInputElement).checked; cb.onAutoRotate(state.autoRotate); });
  $<HTMLInputElement>("opt-heatmap").addEventListener("change", (e) => cb.onHeatmap((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>("opt-heat-spread").addEventListener("input", (e) => cb.onHeatSpread(Number((e.target as HTMLInputElement).value)));
  $("btn-reset-view").addEventListener("click", () => cb.onResetView());

  // --- country list ---
  const list = $("country-list");
  const rows = new Map<string, { el: HTMLElement; cb: HTMLInputElement; country: Country }>();
  const regionBoxes = new Map<string, HTMLInputElement>();
  const byRegion = new Map<string, Country[]>();
  for (const c of data.countries) (byRegion.get(c.region) ?? byRegion.set(c.region, []).get(c.region)!).push(c);

  for (const region of REGION_ORDER) {
    const cs = byRegion.get(region);
    if (!cs?.length) continue;
    const wrap = document.createElement("div");
    wrap.className = "region";
    const head = document.createElement("label");
    head.className = "region-head";
    const rcb = document.createElement("input");
    rcb.type = "checkbox"; rcb.checked = true;
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = "#" + REGION_COLORS[region].toString(16).padStart(6, "0");
    const name = document.createElement("span");
    name.textContent = region;
    const count = document.createElement("span");
    count.className = "count"; count.textContent = String(cs.length);
    head.append(rcb, sw, name, count);
    wrap.appendChild(head);
    regionBoxes.set(region, rcb);
    head.addEventListener("pointerenter", () => cb.onFocus(new Set(cs.map((c) => c.iso3))));
    head.addEventListener("pointerleave", () => cb.onFocus(null));
    rcb.addEventListener("change", () => {
      for (const c of cs) { if (rcb.checked) state.selection.add(c.iso3); else state.selection.delete(c.iso3); rows.get(c.iso3)!.cb.checked = rcb.checked; }
      cb.onSelection(state.selection);
    });
    for (const c of cs) {
      const row = document.createElement("label");
      row.className = "country-row";
      const ccb = document.createElement("input");
      ccb.type = "checkbox"; ccb.checked = true;
      const nm = document.createElement("span");
      nm.textContent = c.name;
      row.append(ccb, nm);
      wrap.appendChild(row);
      rows.set(c.iso3, { el: row, cb: ccb, country: c });
      row.addEventListener("pointerenter", () => cb.onFocus(new Set([c.iso3])));
      row.addEventListener("pointerleave", () => cb.onFocus(null));
      ccb.addEventListener("change", () => {
        if (ccb.checked) state.selection.add(c.iso3); else state.selection.delete(c.iso3);
        rcb.checked = cs.every((x) => state.selection.has(x.iso3));
        rcb.indeterminate = !rcb.checked && cs.some((x) => state.selection.has(x.iso3));
        cb.onSelection(state.selection);
      });
    }
    list.appendChild(wrap);
  }

  const hasAll = (c: Country) => state.axes.every((d) => !d || d.id in c.values);
  const refreshRows = () => {
    for (const r of rows.values()) {
      r.el.classList.toggle("nodata", !hasAll(r.country));
      r.el.title = hasAll(r.country) ? "" : "No data for one of the chosen axes";
    }
  };
  refreshRows();

  const setAll = (on: boolean) => {
    for (const r of rows.values()) { r.cb.checked = on; if (on) state.selection.add(r.country.iso3); else state.selection.delete(r.country.iso3); }
    for (const b of regionBoxes.values()) { b.checked = on; b.indeterminate = false; }
    cb.onSelection(state.selection);
  };
  $("btn-all").addEventListener("click", () => setAll(true));
  $("btn-none").addEventListener("click", () => setAll(false));

  $<HTMLInputElement>("country-search").addEventListener("input", (e) => {
    const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
    for (const r of rows.values()) r.el.classList.toggle("hidden", !!q && !r.country.name.toLowerCase().includes(q) && !r.country.iso3.toLowerCase().includes(q));
  });

  // --- sources footer ---
  const foot = $("sources");
  foot.innerHTML = data.datasets.map((ds) => {
    const links = ds.sources.slice(0, 3).map((u, i) => `<a href="${u.split(" ")[0]}" title="${u}" target="_blank" rel="noopener">[${i + 1}]</a>`).join(" ");
    return `<div><b>${ds.label}</b> ${links}</div>`;
  }).join("") + `<div>${data.countries.length} countries · drag to rotate · scroll to zoom</div>`;

  return state;
}

export function showTooltip(info: { country?: Country; region?: string; count?: number; x: number; y: number } | null, axes: (Dim | null)[]) {
  const tip = $("tooltip");
  if (!info) { tip.hidden = true; return; }
  const { country, x, y } = info;
  if (!country) {
    tip.innerHTML = `<b>${info.region}</b><div class="row"><span>most prevalent region here</span></div><div class="row"><span>countries shown</span><span>${info.count ?? 0}</span></div>`;
    tip.hidden = false;
    place(tip, x, y);
    return;
  }
  const rowsHtml = axes.filter((d): d is Dim => !!d).map((d) => {
    const v = country.values[d.id];
    const off = v !== undefined && (v < d.min || v > d.max) ? " <small>(off scale, clamped)</small>" : "";
    return `<div class="row"><span>${d.short}</span><span>${v === undefined ? "–" : Number.isInteger(v) ? v : v.toFixed(2)}${off}</span></div>`;
  }).join("");
  tip.innerHTML = `<b>${country.name}</b><div class="row"><span>${country.region}</span></div>${rowsHtml}`;
  tip.hidden = false;
  place(tip, x, y);
}

function place(tip: HTMLElement, x: number, y: number) {
  const vp = $("viewport");
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(x + 14, vp.clientWidth - w - 8) + "px";
  tip.style.top = Math.min(y + 14, vp.clientHeight - h - 8) + "px";
}
