import type { Data } from "./types";
import { icon, Icons } from "./icons";
import { HOFSTEDE_INTRO, HOFSTEDE_EDITIONS, HOFSTEDE_DOCS, IW_INTRO, IW_DOCS, REGIONS_NOTE, type DimDoc } from "./docs";

const el = (tag: string, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function dimBlock(doc: DimDoc): HTMLElement {
  const wrap = el("div");
  wrap.appendChild(el("h4", undefined, doc.title));
  wrap.appendChild(el("p", undefined, doc.body));
  const poles = el("div", "poles");
  poles.append(el("b", undefined, "Low"), el("span", undefined, doc.low), el("b", undefined, "High"), el("span", undefined, doc.high));
  wrap.appendChild(poles);
  return wrap;
}

/** Build the "About the axes" modal from the loaded data and wire the ? button. */
export function setupHelp(data: Data) {
  const modal = document.getElementById("help-modal") as HTMLDialogElement;
  const body = document.getElementById("help-body")!;
  body.innerHTML = "";

  const hofEditions = data.datasets.filter((ds) => ds.id.startsWith("hof"));
  if (hofEditions.length) {
    body.appendChild(el("h3", undefined, "Hofstede's cultural dimensions"));
    body.appendChild(el("p", "intro", HOFSTEDE_INTRO));
    if (hofEditions.length > 1) body.appendChild(el("p", "intro", HOFSTEDE_EDITIONS));
    for (const key of ["pdi", "idv", "mas", "uai", "lto", "ivr"]) body.appendChild(dimBlock(HOFSTEDE_DOCS[key]));
  }

  const iwDims = data.dims.filter((d) => d.dataset === "iw");
  if (iwDims.length) {
    body.appendChild(el("h3", undefined, "Inglehart–Welzel cultural map"));
    body.appendChild(el("p", "intro", IW_INTRO));
    body.appendChild(dimBlock(IW_DOCS.trad_sec));
    body.appendChild(dimBlock(IW_DOCS.surv_self));
    const editions = [...new Set(iwDims.map((d) => d.datasetLabel.replace(/^Inglehart–Welzel · /, "")))];
    body.appendChild(el("p", "editions", "Editions available as separate axes: " + editions.join(" · ") + ". Each edition uses the WVS's published country scores for that map; countries are only shown where the chosen edition has data."));
  }

  body.appendChild(el("h3", undefined, "Colours and regions"));
  body.appendChild(el("p", "intro", REGIONS_NOTE));

  const sources = el("p", "editions");
  sources.textContent = "Sources: " + data.datasets.map((ds) => ds.label + " — " + ds.sources.map((s) => s.split(" ")[0]).join(", ")).join(" | ");
  body.appendChild(sources);

  document.getElementById("btn-help")!.replaceChildren(icon(Icons.CircleHelp));
  document.getElementById("btn-help-close")!.replaceChildren(icon(Icons.X));
  document.getElementById("btn-help")!.addEventListener("click", () => { modal.showModal(); body.scrollTop = 0; });
  document.getElementById("btn-help-close")!.addEventListener("click", () => modal.close());
  // click on the backdrop closes
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
}
