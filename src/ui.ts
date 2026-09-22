import type { Country, Data, Dim, Edition } from "./types";
import { REGION_COLORS, REGION_ORDER } from "./regions";

export interface UIState {
  axes: (Dim | null)[];
  selection: Set<string>;
  labels: boolean;
  autoRotate: boolean;
  edition: Edition;
  pinned: Set<string>;         // iso3
  pinnedRegions: Set<string>;  // region names
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
  onPins(countries: Set<string>, regions: Set<string>): void;
  onEdition(ed: Edition): void;
}

export interface UIHandle {
  state: UIState;
  togglePin(target: { country?: Country; region?: string }): void;
  isPinned(target: { country?: Country; region?: string }): boolean;
  hide(target: { country?: Country; region?: string }): void;
}

const PIN_SVG = '<svg viewBox="0 0 16 16"><path d="M9.5 1.5 14.5 6.5l-1.4 1.4-.7-.7-3 3 .3 3.3-1.4 1.4L5 11.6 1.6 15l-.6-.6L4.4 11 1.1 7.7l1.4-1.4 3.3.3 3-3-.7-.7z"/></svg>';

const CHEVRON_SVG = '<svg viewBox="0 0 16 16"><path d="M6 3.5 10.5 8 6 12.5 4.8 11.3 8.1 8 4.8 4.7z"/></svg>';

function readCollapsed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem("collapsedRegions") ?? "[]")); } catch { return new Set(); }
}
function writeCollapsed(set: Set<string>) {
  try { localStorage.setItem("collapsedRegions", JSON.stringify([...set])); } catch { /* storage unavailable */ }
}

function makePin(): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button"; b.className = "pin"; b.title = "Pin"; b.innerHTML = PIN_SVG;
  return b;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function readHashEdition(): Edition {
  const m = location.hash.match(/ed=(2015|2023|both)/);
  return (m ? m[1] : "2015") as Edition;
}

function writeHash(axes: (Dim | null)[], edition: Edition) {
  const a = encodeURIComponent(axes.filter(Boolean).map((d) => d!.id).join(","));
  history.replaceState(null, "", "#axes=" + a + (edition !== "2015" ? "&ed=" + edition : ""));
}

function readHashAxes(dims: Dim[]): (Dim | null)[] | null {
  const m = location.hash.match(/axes=([^&]*)/);
  if (!m) return null;
  const ids = decodeURIComponent(m[1]).split(",");
  const found = ids.map((id) => dims.find((d) => d.id === id) ?? null);
  return found[0] ? [found[0], found[1] ?? null, found[1] ? found[2] ?? null : null] : null;
}

export function buildUI(data: Data, cb: UICallbacks): UIHandle {
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
  const state: UIState = { axes: defaults, selection: new Set(data.countries.map((c) => c.iso3)), labels: true, autoRotate: false, edition: readHashEdition(), pinned: new Set(), pinnedRegions: new Set() };
  selects.forEach((sel, i) => { sel.value = state.axes[i]?.id ?? ""; });

  const syncAxes = () => {
    const picked = selects.map((s) => dims.find((d) => d.id === s.value) ?? null);
    if (!picked[1]) picked[2] = null;
    state.axes = picked;
    selects[2].disabled = !picked[1];
    if (!picked[1]) selects[2].value = "";
    writeHash(picked, state.edition);
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

  // --- Hofstede edition switch (only when more than one edition is loaded) ---
  const edSection = $("edition-section");
  if (data.hofEditions.length > 1) {
    edSection.hidden = false;
    const btns = [...$("edition-switch").querySelectorAll<HTMLButtonElement>("button")];
    const apply = (ed: Edition) => {
      state.edition = ed;
      for (const b of btns) b.classList.toggle("on", b.dataset.ed === ed);
      writeHash(state.axes, ed);
      cb.onEdition(ed);
      refreshRows();
    };
    for (const b of btns) b.addEventListener("click", () => apply(b.dataset.ed as Edition));
    for (const b of btns) b.classList.toggle("on", b.dataset.ed === state.edition);
  } else {
    state.edition = "2015";
  }

  // --- country list ---
  const list = $("country-list");
  const rows = new Map<string, { el: HTMLElement; cb: HTMLInputElement; pin: HTMLButtonElement; country: Country }>();
  const regionBoxes = new Map<string, HTMLInputElement>();
  const regionPins = new Map<string, { head: HTMLElement; pin: HTMLButtonElement }>();
  const regionBodies = new Map<string, { wrap: HTMLElement; body: HTMLElement }>();
  const collapsed = readCollapsed();
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
    const rpin = makePin();
    const chev = document.createElement("button");
    chev.type = "button"; chev.className = "chevron"; chev.innerHTML = CHEVRON_SVG;
    head.append(chev, rcb, sw, name, count, rpin);
    wrap.appendChild(head);
    const body = document.createElement("div");
    body.className = "region-body";
    wrap.appendChild(body);
    regionBodies.set(region, { wrap, body });
    const setCollapsed = (on: boolean) => {
      wrap.classList.toggle("collapsed", on);
      chev.title = on ? "Expand" : "Collapse";
      if (on) collapsed.add(region); else collapsed.delete(region);
      writeCollapsed(collapsed);
    };
    setCollapsed(collapsed.has(region));
    chev.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); setCollapsed(!wrap.classList.contains("collapsed")); });
    regionBoxes.set(region, rcb);
    regionPins.set(region, { head, pin: rpin });
    rpin.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); togglePin({ region }); });
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
      const cpin = makePin();
      row.append(ccb, nm, cpin);
      body.appendChild(row);
      rows.set(c.iso3, { el: row, cb: ccb, pin: cpin, country: c });
      cpin.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); togglePin({ country: c }); });
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

  const isPinned = (t: { country?: Country; region?: string }) =>
    t.country ? state.pinned.has(t.country.iso3) : t.region ? state.pinnedRegions.has(t.region) : false;
  const refreshPins = () => {
    const any = state.pinned.size > 0 || state.pinnedRegions.size > 0;
    list.classList.toggle("has-pins", any);
    $("btn-unpin").hidden = !any;
    for (const r of rows.values()) {
      const on = state.pinned.has(r.country.iso3);
      r.pin.classList.toggle("on", on); r.pin.title = on ? "Unpin" : "Pin";
      r.el.classList.toggle("pinned", on);
      r.el.classList.toggle("region-pinned", state.pinnedRegions.has(r.country.region));
    }
    for (const [region, { head, pin }] of regionPins) {
      const on = state.pinnedRegions.has(region);
      pin.classList.toggle("on", on); pin.title = on ? "Unpin region" : "Pin region";
      head.classList.toggle("pinned", on);
    }
    cb.onPins(state.pinned, state.pinnedRegions);
  };
  const togglePin = (t: { country?: Country; region?: string }) => {
    if (t.country) { if (state.pinned.has(t.country.iso3)) state.pinned.delete(t.country.iso3); else state.pinned.add(t.country.iso3); }
    else if (t.region) { if (state.pinnedRegions.has(t.region)) state.pinnedRegions.delete(t.region); else state.pinnedRegions.add(t.region); }
    refreshPins();
  };
  $("btn-unpin").addEventListener("click", () => { state.pinned.clear(); state.pinnedRegions.clear(); refreshPins(); });

  /** Deselect a country, or every country of a region, keeping the checkboxes in sync. */
  const hide = (t: { country?: Country; region?: string }) => {
    const targets = t.country ? [t.country] : t.region ? (byRegion.get(t.region) ?? []) : [];
    for (const c of targets) { state.selection.delete(c.iso3); rows.get(c.iso3)!.cb.checked = false; }
    for (const [region, rcb] of regionBoxes) {
      const cs = byRegion.get(region) ?? [];
      rcb.checked = cs.every((x) => state.selection.has(x.iso3));
      rcb.indeterminate = !rcb.checked && cs.some((x) => state.selection.has(x.iso3));
    }
    cb.onSelection(state.selection);
  };

  const valueFor = (c: Country, d: Dim): number | undefined => {
    if (!d.editionKeys) return c.values[d.id];
    const v2015 = c.values[d.editionKeys["2015"]], v2023 = c.values[d.editionKeys["2023"]];
    return state.edition === "2015" ? v2015 : state.edition === "2023" ? v2023 : (v2023 ?? v2015);
  };
  const hasAll = (c: Country) => state.axes.every((d) => !d || valueFor(c, d) !== undefined);
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
    for (const [region, { wrap, body }] of regionBodies) {
      const anyMatch = [...body.children].some((el) => !el.classList.contains("hidden"));
      // while searching, force-open regions with matches and hide regions without; restore stored state when cleared
      wrap.classList.toggle("hidden", !!q && !anyMatch);
      wrap.classList.toggle("collapsed", q ? false : collapsed.has(region));
    }
  });

  // --- sources footer ---
  const foot = $("sources");
  foot.innerHTML = data.datasets.map((ds) => {
    const links = ds.sources.slice(0, 3).map((u, i) => `<a href="${u.split(" ")[0]}" title="${u}" target="_blank" rel="noopener">[${i + 1}]</a>`).join(" ");
    return `<div><b>${ds.label}</b> ${links}</div>`;
  }).join("") + `<div>${data.countries.length} countries · drag to rotate · Space+drag to pan · scroll to zoom</div>`;

  return { state, togglePin, isPinned, hide };
}

export function isContextMenuOpen(): boolean { return !$("ctx-menu").hidden; }

export function showTooltip(info: { country?: Country; region?: string; count?: number; x: number; y: number } | null, axes: (Dim | null)[], edition: Edition = "2015") {
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
    const fmt = (v: number | undefined) => (v === undefined ? "–" : Number.isInteger(v) ? String(v) : v.toFixed(2));
    let v: number | undefined;
    let text: string;
    if (d.editionKeys && edition === "both") {
      const a = country.values[d.editionKeys["2015"]], b = country.values[d.editionKeys["2023"]];
      v = b ?? a;
      text = a !== undefined && b !== undefined && a !== b ? fmt(a) + " → " + fmt(b) : fmt(v);
    } else {
      v = d.editionKeys ? country.values[d.editionKeys[edition]] : country.values[d.id];
      text = fmt(v);
    }
    const off = v !== undefined && (v < d.min || v > d.max) ? " <small>(off scale, clamped)</small>" : "";
    return `<div class="row"><span>${d.short}</span><span>${text}${off}</span></div>`;
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

/** Show the chart context menu for a hovered country/region; hides on any click or Escape. */
export function showContextMenu(info: { country?: Country; region?: string; x: number; y: number } | null, ui: UIHandle) {
  const menu = $("ctx-menu");
  menu.hidden = true;
  if (!info || (!info.country && !info.region)) return;
  $("tooltip").hidden = true;
  const label = info.country ? info.country.name : info.region!;
  const pinned = ui.isPinned(info);
  menu.innerHTML = "";
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = label;
  menu.appendChild(title);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = pinned ? "Unpin" : "Pin";
  btn.addEventListener("click", () => { ui.togglePin(info); menu.hidden = true; });
  menu.appendChild(btn);
  const hideBtn = document.createElement("button");
  hideBtn.type = "button";
  hideBtn.textContent = info.country ? "Hide" : "Hide region";
  hideBtn.addEventListener("click", () => { ui.hide(info); menu.hidden = true; });
  menu.appendChild(hideBtn);
  if (ui.state.pinned.size || ui.state.pinnedRegions.size) {
    const all = document.createElement("button");
    all.type = "button"; all.textContent = "Unpin all";
    all.addEventListener("click", () => { ui.state.pinned.clear(); ui.state.pinnedRegions.clear(); ui.togglePin({}); menu.hidden = true; });
    menu.appendChild(all);
  }
  menu.hidden = false;
  const vp = $("viewport");
  menu.style.left = Math.min(info.x + 4, vp.clientWidth - menu.offsetWidth - 8) + "px";
  menu.style.top = Math.min(info.y + 4, vp.clientHeight - menu.offsetHeight - 8) + "px";
  const close = (e: Event) => {
    if (e instanceof KeyboardEvent && e.key !== "Escape") return;
    if (e.type === "pointerdown" && menu.contains(e.target as Node)) return;
    menu.hidden = true;
    window.removeEventListener("pointerdown", close, true);
    window.removeEventListener("keydown", close, true);
  };
  setTimeout(() => { window.addEventListener("pointerdown", close, true); window.addEventListener("keydown", close, true); });
}
