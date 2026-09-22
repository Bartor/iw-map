import { loadData } from "./datasets";
import { CultureScene } from "./scene";
import { buildUI, showTooltip } from "./ui";

async function main() {
  const data = await loadData();
  const viewport = document.getElementById("viewport")!;
  const scene = new CultureScene(viewport, data.countries);
  const hint = document.getElementById("empty-hint")!;

  const updateHint = () => {
    const any = data.countries.some((c) => state.selection.has(c.iso3) && scene.hasAllValues(c));
    hint.hidden = any;
  };

  const state = buildUI(data, {
    onAxes: (axes) => { scene.setAxes(axes); updateHint(); },
    onSelection: (sel) => { scene.setSelection(sel); updateHint(); },
    onLabels: (on) => scene.setLabels(on),
    onAutoRotate: (on) => scene.setAutoRotate(on),
    onResetView: () => scene.resetView(),
    onFocus: (set) => scene.setFocus(set),
  });

  scene.onHover = (info) => showTooltip(info, state.axes);
  scene.setSelection(state.selection);
  scene.setAxes(state.axes);
  updateHint();
}

main().catch((err) => {
  console.error(err);
  document.getElementById("viewport")!.textContent = "Failed to load: " + err;
});
