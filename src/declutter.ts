/**
 * Greedy screen-space label placement with leader lines.
 * Each label gets the first collision-free box around its anchor, trying the
 * previous frame's slot first so placements stay stable while the view moves.
 */

export interface LabelItem {
  id: string;
  ax: number;       // anchor (marker centre) in CSS px
  ay: number;
  w: number;        // label box size
  h: number;
  priority: number; // higher is placed first
}

export interface Placement {
  x: number;        // box top-left in CSS px
  y: number;
  slot: number;     // index into the candidate list (0 = default position, no leader)
  hidden: boolean;
}

interface Rect { x: number; y: number; w: number; h: number }

const RADII = [7, 16, 28, 42, 60, 80];
// direction unit vectors: preferred up-right first, then right, up, left, down, remaining diagonals
const DIRS: Array<[number, number]> = [[1, -1], [1, 0], [0, -1], [-1, 0], [0, 1], [-1, -1], [1, 1], [-1, 1]];
const PREFERRED = 0; // index into DIRS: labels try this direction at every radius before any other direction

const MARKER_R = 7; // px half-size of the keep-out box around a marker

function overlaps(a: Rect, b: Rect, pad = 2): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

/** Box for candidate slot `slot` of an item: the box is pushed out along a direction so its near edge sits at radius r. */
function slotBox(it: LabelItem, slot: number): Rect {
  const r = RADII[Math.floor(slot / DIRS.length)];
  const [dx, dy] = DIRS[slot % DIRS.length];
  const diag = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
  const cx = it.ax + dx * diag * (r + (dx !== 0 ? it.w / 2 : 0));
  const cy = it.ay + dy * diag * (r + (dy !== 0 ? it.h / 2 : 0));
  return { x: cx - it.w / 2, y: cy - it.h / 2, w: it.w, h: it.h };
}

export const SLOT_COUNT = RADII.length * DIRS.length;

export function placeLabels(items: LabelItem[], width: number, height: number, prev: Map<string, Placement>): Map<string, Placement> {
  const out = new Map<string, Placement>();
  const placed: Rect[] = [];
  // markers themselves are obstacles
  const markers: Rect[] = items.map((it) => ({ x: it.ax - MARKER_R, y: it.ay - MARKER_R, w: MARKER_R * 2, h: MARKER_R * 2 }));
  const order = [...items].sort((a, b) => b.priority - a.priority || a.ay - b.ay);
  const inView = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= width && r.y + r.h <= height;
  const free = (r: Rect) => inView(r) && !placed.some((p) => overlaps(r, p)) && !markers.some((m) => overlaps(r, m, 0));

  for (const it of order) {
    const last = prev.get(it.id);
    const tryOrder: number[] = [];
    if (last && !last.hidden) tryOrder.push(last.slot);
    // consistent look: walk the preferred direction outwards first, then everything else nearest-first
    for (let r = 0; r < RADII.length; r++) { const s = r * DIRS.length + PREFERRED; if (s !== last?.slot) tryOrder.push(s); }
    for (let s = 0; s < SLOT_COUNT; s++) if (s % DIRS.length !== PREFERRED && s !== last?.slot) tryOrder.push(s);
    let chosen: Placement | null = null;
    for (const s of tryOrder) {
      const box = slotBox(it, s);
      if (free(box)) { chosen = { x: box.x, y: box.y, slot: s, hidden: false }; break; }
    }
    if (chosen) placed.push({ x: chosen.x, y: chosen.y, w: it.w, h: it.h });
    out.set(it.id, chosen ?? { x: it.ax, y: it.ay, slot: 0, hidden: true });
  }
  return out;
}
