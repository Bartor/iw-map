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

/**
 * Candidate order: the preferred direction at the three nearest rings, then the other
 * directions at the two nearest rings, then the preferred direction further out, then the rest.
 * A label only leaves its previous slot when a better-ranked slot is free.
 */
const ORDER: number[] = (() => {
  const slot = (r: number, dir: number) => r * DIRS.length + dir;
  const out: number[] = [];
  for (let r = 0; r < 3; r++) out.push(slot(r, PREFERRED));
  for (let r = 0; r < 2; r++) for (let dir = 0; dir < DIRS.length; dir++) if (dir !== PREFERRED) out.push(slot(r, dir));
  for (let r = 3; r < RADII.length; r++) out.push(slot(r, PREFERRED));
  for (let r = 2; r < RADII.length; r++) for (let dir = 0; dir < DIRS.length; dir++) if (dir !== PREFERRED) out.push(slot(r, dir));
  return out;
})();

export function placeLabels(items: LabelItem[], width: number, height: number, prev: Map<string, Placement>): Map<string, Placement> {
  const out = new Map<string, Placement>();
  const placed: Rect[] = [];
  // markers themselves are obstacles
  const markers: Rect[] = items.map((it) => ({ x: it.ax - MARKER_R, y: it.ay - MARKER_R, w: MARKER_R * 2, h: MARKER_R * 2 }));
  const order = [...items].sort((a, b) => b.priority - a.priority || a.ay - b.ay);
  const inView = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= width && r.y + r.h <= height;
  const free = (r: Rect) => inView(r) && !placed.some((p) => overlaps(r, p)) && !markers.some((m) => overlaps(r, m, 0));

  for (const it of order) {
    // slots ranked best-first; the previous slot is promoted by one rank (hysteresis) so a label
    // leaves it only for a clearly better slot or when it is displaced
    const last = prev.get(it.id);
    let tryOrder = ORDER;
    if (last && !last.hidden) {
      const rank = ORDER.indexOf(last.slot);
      const cut = Math.max(0, rank - 1);
      tryOrder = [...ORDER.slice(0, cut), last.slot, ...ORDER.slice(cut).filter((s) => s !== last.slot)];
    }
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
