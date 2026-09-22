import { loadData } from "./datasets";
import { CultureScene } from "./scene";
import { buildUI, showTooltip, showContextMenu, isContextMenuOpen } from "./ui";
import { setupHelp } from "./help";

async function main() {
  const data = await loadData();
  const viewport = document.getElementById("viewport")!;
  const scene = new CultureScene(viewport, data.countries);
  const hint = document.getElementById("empty-hint")!;

  const updateHint = () => {
    const any = data.countries.some((c) => state.selection.has(c.iso3) && scene.hasAllValues(c));
    hint.hidden = any;
  };

  const ui = buildUI(data, {
    onAxes: (axes) => { scene.setAxes(axes); updateHint(); },
    onSelection: (sel) => { scene.setSelection(sel); updateHint(); },
    onLabels: (on) => scene.setLabels(on),
    onAutoRotate: (on) => scene.setAutoRotate(on),
    onResetView: () => scene.resetView(),
    onFocus: (set) => scene.setFocus(set),
    onHeatmap: (on) => scene.setHeatmap(on),
    onHeatSpread: (t) => scene.setHeatSpread(t),
    onEdition: (ed) => { scene.setEdition(ed); updateHint(); },
    onPins: (countries, regions) => scene.setPins(countries, regions),
  });
  const state = ui.state;

  setupHelp(data);
  scene.onHover = (info) => { if (!isContextMenuOpen()) showTooltip(info, state.axes, state.edition); };
  scene.onContextMenu = (info) => showContextMenu(info, ui);
  scene.onClick = (info) => ui.togglePin(info);
  scene.setHeatSpread(0.5);
  scene.setEdition(state.edition);
  scene.setSelection(state.selection);
  scene.setAxes(state.axes);
  updateHint();
}

main().catch((err) => {
  console.error(err);
  document.getElementById("viewport")!.textContent = "Failed to load: " + err;
});
