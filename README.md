# Cultural Dimensions Map

Interactive 3D visualisation of national cultures using two published frameworks:

- **Hofstede's 6-D model** (Power Distance, Individualism, Motivation towards Achievement / Masculinity, Uncertainty Avoidance, Long Term Orientation, Indulgence)
- **Inglehart–Welzel cultural map** (Traditional vs Secular-rational, Survival vs Self-expression), across several World Values Survey map editions

Pick one, two or three dimensions from any dataset and countries are laid out on a line, a square or a cube. Changing the number of axes morphs the frame (line expands into a square, square into a cube) and countries glide to their new positions. Drag to rotate (3D only), hold Space and drag to pan, scroll to zoom. In 2D and 1D the view cannot be rotated and left-drag pans. Hovering a country (in the scene or the list) or a region header fades everything else.

**Pins.** The pin icon on a country row or region header, or right-click on a country or territory in the chart, pins it. While anything is pinned, unpinned countries and territories drop to half opacity. *Unpin* clears all pins.

**Region heatmap** builds a Gaussian kernel density per world region from the currently selected countries and draws, for each region, the volume where it is the most prevalent region (marching-cubes isosurface in the region's colour). The *Spread* slider sets the kernel width. In 2D and 1D the volumes flatten into a sheet or band.

## Run

```bash
npm install
npm run dev
```

Build for static hosting with `npm run build` (output in `dist/`).

## Data

Numerical scores live in `data/`:

- `hofstede.json` – official geerthofstede.com 2015 dimension matrix (gaps filled from theculturefactor.com). See `hofstede_sources.md`.
- `hofstede_2023.json` – The Culture Factor 2023 update (119 countries, revised Individualism and Long Term Orientation), kept as a separate edition so the two can be compared.
- `inglehart_welzel.json` – country coordinates per WVS map edition. See `inglehart_welzel_sources.md`.

Sub-national or regional Hofstede entries (e.g. "Belgium French", "Arab countries") have no ISO code and are grouped under "Other".

## Stack

Vite, TypeScript, three.js (OrbitControls + CSS2DRenderer for labels). No framework.
