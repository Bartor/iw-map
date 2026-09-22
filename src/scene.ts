import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Country, Dim, Edition } from "./types";
import { Anim, Anim3, easeOutCubic } from "./tween";
import { REGION_COLORS } from "./regions";
import { Heatmap, type HeatPoint } from "./heatmap";

const S = 10;            // frame edge length in world units
const GRID_N = 10;       // grid subdivisions per face
const MARKER_R = 0.13;
const MARKER_REF_DIST = 24;   // markers keep the on-screen size they have at this camera distance

interface Marker {
  country: Country;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  label: CSS2DObject;
  pos: Anim3;      // frame-local position, 0..S per axis
  scale: Anim;     // 0 hidden .. 1 visible
  dim: Anim;       // 0 normal .. 1 faded
  visible: boolean;
}

export interface HoverInfo { country?: Country; region?: string; count?: number; x: number; y: number }

function makeLabel(cls: string, text = ""): CSS2DObject {
  const el = document.createElement("div");
  el.className = cls;
  const inner = document.createElement("span");
  inner.textContent = text;
  el.appendChild(inner);
  const obj = new CSS2DObject(el);
  obj.center.set(0, 1);
  return obj;
}

function unitGrid(plane: "xy" | "xz" | "yz"): THREE.LineSegments {
  const pts: number[] = [];
  for (let i = 0; i <= GRID_N; i++) {
    const t = i / GRID_N;
    if (plane === "xy") pts.push(t, 0, 0, t, 1, 0, 0, t, 0, 1, t, 0);
    if (plane === "xz") pts.push(t, 0, 0, t, 0, 1, 0, 0, t, 1, 0, t);
    if (plane === "yz") pts.push(0, t, 0, 0, t, 1, 0, 0, t, 0, 1, t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const m = new THREE.LineBasicMaterial({ color: 0x2a3446, transparent: true, opacity: 0 });
  return new THREE.LineSegments(g, m);
}

function unitEdges(): THREE.LineSegments {
  const c = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const e = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const pts: number[] = [];
  for (const [a, b] of e) pts.push(...c[a], ...c[b]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x5b6b8a, transparent: true, opacity: 0.9 }));
}

export class CultureScene {
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-10, -10);
  private pointerPx = { x: 0, y: 0 };

  private ext = { x: new Anim(1), y: new Anim(0), z: new Anim(0) };
  private frame = new THREE.Group();
  private edges = unitEdges();
  private grids = { xy: unitGrid("xy"), xz: unitGrid("xz"), yz: unitGrid("yz") };
  private axisLabels = { x: makeLabel("axis-label"), y: makeLabel("axis-label"), z: makeLabel("axis-label") };
  private tickLabels = {
    x: [makeLabel("tick-label"), makeLabel("tick-label")],
    y: [makeLabel("tick-label"), makeLabel("tick-label")],
    z: [makeLabel("tick-label"), makeLabel("tick-label")],
  };

  private markers = new Map<string, Marker>();
  private markerGroup = new THREE.Group();
  private sphereGeo = new THREE.SphereGeometry(MARKER_R, 20, 14);
  private axes: (Dim | null)[] = [null, null, null];
  private selection = new Set<string>();
  private showLabels = true;
  private hovered: Marker | null = null;
  private hoveredRegion: string | null = null;
  private focus: Set<string> | null = null;   // external focus (from the list panel)
  private edition: Edition = "2023";
  private heatmap = new Heatmap(S);
  private heatDirty = true;
  // guide lines from hovered/pinned markers to each active axis, plus value labels at the axis feet
  private guideGeo = new THREE.BufferGeometry();
  private guides = new THREE.LineSegments(this.guideGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }));
  private guideLabels: CSS2DObject[] = [];

  private camPos = new Anim3(0, 0, 0, 1100, easeOutCubic);
  private camTarget = new Anim3(0, 0, 0, 1100, easeOutCubic);
  private camAnimating = false;
  private lastNdims = -1;

  onHover: ((info: HoverInfo | null) => void) | null = null;
  /** Right-click on the chart; info is the hovered country/region (or null) plus pointer position. */
  onContextMenu: ((info: HoverInfo | null) => void) | null = null;
  /** Plain left-click (no drag) on a country marker or territory shell. */
  onClick: ((info: HoverInfo) => void) | null = null;
  private pinned = new Set<string>();
  private pinnedRegions = new Set<string>();

  constructor(private container: HTMLElement, countries: Country[]) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x0b0e14, 1);
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    Object.assign(this.labelRenderer.domElement.style, { position: "absolute", top: "0", left: "0", pointerEvents: "none", zIndex: "1" });
    container.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.camera.position.set(0, 0, 24);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 80;
    this.controls.autoRotateSpeed = 0.8;
    this.controls.addEventListener("start", () => { this.camAnimating = false; });

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(5, 10, 8); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4); fill.position.set(-6, -3, -5); this.scene.add(fill);

    this.frame.add(this.edges, this.grids.xy, this.grids.xz, this.grids.yz);
    this.scene.add(this.frame);
    for (const l of [...Object.values(this.axisLabels), ...Object.values(this.tickLabels).flat()]) this.scene.add(l);
    this.scene.add(this.markerGroup);
    this.scene.add(this.heatmap.group);
    this.guides.renderOrder = 5;
    this.guides.frustumCulled = false;
    this.scene.add(this.guides);

    for (const c of countries) this.addMarker(c);

    this.renderer.domElement.addEventListener("pointermove", (e) => {
      const r = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pointerPx = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    this.renderer.domElement.addEventListener("pointerleave", () => { this.pointer.set(-10, -10); });
    // click vs drag: a left button press that moves less than a few pixels is a click
    let press: { x: number; y: number; t: number } | null = null;
    this.renderer.domElement.addEventListener("pointerdown", (e) => { press = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (!press || e.button !== 0) return;
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      const held = performance.now() - press.t;
      press = null;
      if (moved > 4 || held > 600 || this.spaceHeld) return;
      const r = this.renderer.domElement.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (this.hovered) this.onClick?.({ country: this.hovered.country, x, y });
      else if (this.hoveredRegion) this.onClick?.({ region: this.hoveredRegion, x, y });
    });
    this.renderer.domElement.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const r = this.renderer.domElement.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (this.hovered) this.onContextMenu?.({ country: this.hovered.country, x, y });
      else if (this.hoveredRegion) this.onContextMenu?.({ region: this.hoveredRegion, x, y });
      else this.onContextMenu?.(null);
    });

    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    };
    window.addEventListener("keydown", (e) => {
      if (e.code !== "Space" || isTyping(e)) return;
      e.preventDefault();
      if (!this.spaceHeld) { this.spaceHeld = true; this.applyControlMode(); }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code !== "Space") return;
      this.spaceHeld = false; this.applyControlMode();
    });
    window.addEventListener("blur", () => { this.spaceHeld = false; this.applyControlMode(); });

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop((t) => this.tick(t));
  }

  private addMarker(country: Country) {
    const color = REGION_COLORS[country.region] ?? REGION_COLORS.Other;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, emissive: color, emissiveIntensity: 0.15, transparent: true });
    const mesh = new THREE.Mesh(this.sphereGeo, mat);
    mesh.scale.setScalar(0.0001);
    mesh.userData.iso3 = country.iso3;
    const label = makeLabel("label", country.name);
    label.visible = false;
    mesh.add(label);
    this.markerGroup.add(mesh);
    this.markers.set(country.iso3, { country, mesh, label, pos: new Anim3(0, 0, 0), scale: new Anim(0, 500, easeOutCubic), dim: new Anim(0, 250, easeOutCubic), visible: false });
  }

  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  get ndims() { return this.axes.filter(Boolean).length; }

  setAxes(axes: (Dim | null)[]) {
    this.axes = [axes[0] ?? null, axes[1] ?? null, axes[2] ?? null];
    const now = performance.now();
    this.ext.x.set(this.axes[0] ? 1 : 0, now);
    this.ext.y.set(this.axes[1] ? 1 : 0, now);
    this.ext.z.set(this.axes[2] ? 1 : 0, now);
    const keys = ["x", "y", "z"] as const;
    keys.forEach((k, i) => {
      const d = this.axes[i];
      this.axisLabels[k].element.textContent = d ? d.short : "";
      this.tickLabels[k][0].element.textContent = d ? `${d.min}${d.lowLabel ? " · " + d.lowLabel : ""}` : "";
      this.tickLabels[k][1].element.textContent = d ? `${d.max}${d.highLabel ? " · " + d.highLabel : ""}` : "";
    });
    this.labelRenderer.domElement.classList.toggle("one-d", this.ndims === 1);
    this.applyControlMode();
    this.retarget(now);
    if (this.ndims !== this.lastNdims) {
      this.lastNdims = this.ndims;
      this.resetView();
    }
  }

  setSelection(sel: Set<string>) {
    this.selection = sel;
    this.retarget(performance.now());
  }

  /** Highlight these countries and fade all others; null clears. */
  setFocus(iso3s: Set<string> | null) { this.focus = iso3s; }
  setPins(countries: Set<string>, regions: Set<string>) { this.pinned = countries; this.pinnedRegions = regions; this.heatmap.setPinned(regions); }
  setHeatmap(on: boolean) { this.heatmap.setEnabled(on); this.heatDirty = true; }
  setHeatSpread(t: number) { this.heatmap.setSpread(t); this.heatDirty = true; }
  setLabels(on: boolean) { this.showLabels = on; }
  private autoRotate = false;
  private spaceHeld = false;
  setAutoRotate(on: boolean) { this.autoRotate = on; this.applyControlMode(); }

  /** 3D: orbit + pan + zoom. 2D/1D: pan + zoom only (left-drag pans), no auto-rotate. */
  private applyControlMode() {
    const three = this.ndims >= 3;
    this.controls.enableRotate = three;
    this.controls.autoRotate = three && this.autoRotate;
    // in 3D, holding Space turns left-drag into pan
    this.controls.mouseButtons.LEFT = three && !this.spaceHeld ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    this.renderer.domElement.classList.toggle("pan-mode", this.spaceHeld && three);
    this.controls.touches.ONE = three ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
    this.controls.screenSpacePanning = true;
  }

  resetView() {
    const n = this.ndims;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const aspect = this.camera.aspect || 1;
    // world-space extents to fit (frame plus room for labels)
    const w = S + 4, h = (n >= 2 ? S : 0) + 3;
    const dist2d = Math.max(w / (2 * tanHalf * aspect), h / (2 * tanHalf)) * 1.05;
    const dist3d = (S * Math.sqrt(3) / 2 + 2) / (tanHalf * Math.min(aspect, 1)) * 1.02;
    const dir = n >= 3 ? new THREE.Vector3(15, 10, 17).normalize() : new THREE.Vector3(0, 0, 1);
    const pos = dir.multiplyScalar(n >= 3 ? dist3d : dist2d).toArray();
    this.camPos.jump(this.camera.position.x, this.camera.position.y, this.camera.position.z);
    this.camTarget.jump(this.controls.target.x, this.controls.target.y, this.controls.target.z);
    const now = performance.now();
    this.camPos.set(pos[0], pos[1], pos[2], now);
    this.camTarget.set(0, 0, 0, now);
    this.camAnimating = true;
  }

  /** Value of a dimension for a country in a given edition (non-edition dims ignore the edition). */
  static valueOf(c: Country, d: Dim, edition: "2015" | "2023"): number | undefined {
    const key = d.editionKeys ? d.editionKeys[edition] : d.id;
    return key === undefined ? undefined : c.values[key];
  }

  /** Value used for the marker position under the selected edition. */
  currentValue(c: Country, d: Dim): number | undefined {
    return CultureScene.valueOf(c, d, this.edition);
  }

  /** Which countries currently have data for every active axis (under the current edition mode). */
  hasAllValues(c: Country): boolean {
    return this.axes.every((d) => !d || this.currentValue(c, d) !== undefined);
  }

  setEdition(ed: Edition) {
    this.edition = ed;
    this.retarget(performance.now());
  }

  private retarget(now: number) {
    const axisKeys = ["x", "y", "z"] as const;
    for (const m of this.markers.values()) {
      const c = m.country;
      const show = this.selection.has(c.iso3) && this.hasAllValues(c) && this.ndims > 0;
      const norm = (d: Dim, v: number) => THREE.MathUtils.clamp((v - d.min) / (d.max - d.min), 0, 1) * S;
      const coord = (i: number) => {
        const d = this.axes[i];
        if (!d) return 0;
        const v = this.currentValue(c, d);
        if (v === undefined) return m.pos[axisKeys[i]].target;
        return norm(d, v);
      };
      const [x, y, z] = [coord(0), coord(1), coord(2)];
      if (show && !m.visible) m.pos.jump(x, y, z); else m.pos.set(x, y, z, now);
      m.scale.set(show ? 1 : 0, now);
      m.visible = show;
    }
  }

  private tick(now: number) {
    for (const a of Object.values(this.ext)) a.update(now);
    const ex = this.ext.x.value, ey = this.ext.y.value, ez = this.ext.z.value;
    const off = new THREE.Vector3(-S * ex / 2, -S * ey / 2, -S * ez / 2);

    this.frame.scale.set(Math.max(S * ex, 1e-4), Math.max(S * ey, 1e-4), Math.max(S * ez, 1e-4));
    this.frame.position.copy(off);
    (this.grids.xy.material as THREE.LineBasicMaterial).opacity = 0.9 * ey * ex;
    (this.grids.xz.material as THREE.LineBasicMaterial).opacity = 0.9 * ez * ex;
    (this.grids.yz.material as THREE.LineBasicMaterial).opacity = 0.9 * ey * ez;

    // axis labels & ticks (world coords, unscaled offsets)
    const g = 0.7;
    this.axisLabels.x.position.set(off.x + S * ex / 2, off.y - g, off.z + S * ez);
    this.tickLabels.x[0].position.set(off.x, off.y - g * 0.55, off.z + S * ez);
    this.tickLabels.x[1].position.set(off.x + S * ex, off.y - g * 0.55, off.z + S * ez);
    this.axisLabels.y.position.set(off.x - g, off.y + S * ey / 2, off.z + S * ez);
    this.tickLabels.y[0].position.set(off.x - g * 0.5, off.y, off.z + S * ez);
    this.tickLabels.y[1].position.set(off.x - g * 0.5, off.y + S * ey, off.z + S * ez);
    this.axisLabels.z.position.set(off.x + S * ex + g, off.y - g * 0.3, off.z + S * ez / 2);
    this.tickLabels.z[0].position.set(off.x + S * ex + g * 0.5, off.y, off.z);
    this.tickLabels.z[1].position.set(off.x + S * ex + g * 0.5, off.y, off.z + S * ez);
    const fade = (o: CSS2DObject, e: number) => { o.element.style.opacity = String(Math.max(0, Math.min(1, (e - 0.3) / 0.7))); o.visible = e > 0.3; };
    fade(this.axisLabels.x, ex); this.tickLabels.x.forEach((t) => fade(t, ex));
    fade(this.axisLabels.y, ey); this.tickLabels.y.forEach((t) => fade(t, ey));
    fade(this.axisLabels.z, ez); this.tickLabels.z.forEach((t) => fade(t, ez));
    this.tickLabels.x[0].center.set(0, 0); this.tickLabels.x[1].center.set(1, 0);
    this.tickLabels.y[0].center.set(1, 1); this.tickLabels.y[1].center.set(1, 0);
    this.tickLabels.z[0].center.set(0, 0.5); this.tickLabels.z[1].center.set(0, 0.5);
    this.axisLabels.x.center.set(0.5, 0); this.axisLabels.y.center.set(1, 0.5); this.axisLabels.z.center.set(0, 0.5);

    // markers
    const focus = this.hovered ? new Set([this.hovered.country.iso3])
      : this.hoveredRegion ? new Set([...this.markers.values()].filter((m) => m.country.region === this.hoveredRegion).map((m) => m.country.iso3))
      : this.focus;
    let moving = !(this.ext.x.done && this.ext.y.done && this.ext.z.done);
    const heatPts: HeatPoint[] = [];
    for (const m of this.markers.values()) {
      const isPinned = this.pinned.has(m.country.iso3) || this.pinnedRegions.has(m.country.region);
      const anyPins = this.pinned.size > 0 || this.pinnedRegions.size > 0;
      // hover focus fades others strongly; otherwise pins fade unpinned items to ~half opacity
      m.dim.set(focus ? (focus.has(m.country.iso3) ? 0 : 1) : anyPins && !isPinned ? 0.57 : 0, now);
      m.pos.update(now); m.scale.update(now); m.dim.update(now);
      const s = m.scale.value;
      const fade = 1 - 0.88 * m.dim.value;
      m.mesh.material.opacity = fade;
      m.mesh.material.depthWrite = fade > 0.5;
      const hov = m === this.hovered ? 1.6 : 1;
      m.mesh.position.set(off.x + m.pos.x.value, off.y + m.pos.y.value, off.z + m.pos.z.value);
      // constant screen-space size: world radius grows linearly with distance to the camera
      const dist = this.camera.position.distanceTo(m.mesh.position);
      m.mesh.scale.setScalar(Math.max(s * hov * dist / MARKER_REF_DIST, 1e-4));
      m.mesh.visible = s > 0.001;
      if (!m.pos.done || !m.scale.done) moving = true;
      if (s > 0.001) heatPts.push({ x: m.mesh.position.x, y: m.mesh.position.y, z: m.mesh.position.z, w: s, region: m.country.region });
      m.label.visible = this.showLabels && s > 0.6;
      m.label.element.style.opacity = String(s * (1 - 0.9 * m.dim.value));
    }

    // flatten territories along collapsed axes so 2D/1D views get a sheet / band, not a slab
    this.heatmap.group.scale.set(1, THREE.MathUtils.lerp(0.06, 1, ey), THREE.MathUtils.lerp(0.06, 1, ez));
    if (this.heatmap.enabled && (moving || this.heatDirty)) {
      this.heatmap.update(heatPts);
      this.heatDirty = false;
    }

    // guide lines for hovered / pinned markers
    {
      const pts: number[] = [], cols: number[] = [];
      let li = 0;
      const col = new THREE.Color();
      const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
      const label = (i: number, x: number, y: number, z: number, text: string, cx: number, cy: number) => {
        let l = this.guideLabels[i];
        if (!l) { l = makeLabel("guide-label"); this.scene.add(l); this.guideLabels[i] = l; }
        l.position.set(x, y, z); l.center.set(cx, cy);
        (l.element.firstChild as HTMLElement).textContent = text;
        l.visible = true;
      };
      for (const m of this.markers.values()) {
        const active = m === this.hovered || this.pinned.has(m.country.iso3) || this.pinnedRegions.has(m.country.region);
        if (!active || m.scale.value < 0.5) continue;
        col.set(REGION_COLORS[m.country.region] ?? REGION_COLORS.Other);
        const p = m.mesh.position;
        // one line per active axis, parallel to that axis, from the marker to the gridded face it starts from
        // (x=0 wall, y=0 floor, z=0 back wall). The badge at each foot reads the axis the foot lands on:
        // the X-parallel line meets the Y axis/wall (shows Y), the Y-parallel line meets the X axis/floor (shows X),
        // the Z-parallel line meets the back wall (shows Z).
        const feet: Array<[number, number, number, number, number, number]> = [];
        if (this.axes[0] && this.axes[1]) feet.push([off.x, p.y, p.z, 1, 1, 0.5]);
        if (this.axes[1] && this.axes[0]) feet.push([p.x, off.y, p.z, 0, 0.5, 0]);
        if (this.axes[2]) feet.push([p.x, p.y, off.z, 2, 0.5, 1]);
        for (const [fx, fy, fz, ai, cx, cy] of feet) {
          pts.push(p.x, p.y, p.z, fx, fy, fz);
          cols.push(col.r, col.g, col.b, col.r, col.g, col.b);
          const d = this.axes[ai]!;
          const v = this.currentValue(m.country, d);
          if (v !== undefined) label(li++, fx, fy, fz, fmt(v), cx, cy);
        }
      }
      for (let i = li; i < this.guideLabels.length; i++) this.guideLabels[i].visible = false;
      this.guideGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      this.guideGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
      this.guides.visible = pts.length > 0;
    }

    // hover
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.markerGroup.children.filter((o) => o.visible), false);
    const hit = hits[0] ? this.markers.get(hits[0].object.userData.iso3) ?? null : null;
    // region shells are only considered when no country is under the pointer
    let region: string | null = null;
    if (!hit && this.heatmap.enabled) {
      // ignore parts of the shells that the clipping planes cut away (outside the frame)
      const inside = (p: THREE.Vector3) => Math.abs(p.x) <= S / 2 + 0.05 && Math.abs(p.y) <= S / 2 + 0.05 && Math.abs(p.z) <= S / 2 + 0.05;
      const rh = this.raycaster.intersectObjects(this.heatmap.meshes, false).find((h) => inside(h.point));
      region = rh ? (rh.object.userData.region as string) : null;
    }
    const changed = hit !== this.hovered || region !== this.hoveredRegion;
    this.hovered = hit;
    if (region !== this.hoveredRegion) { this.hoveredRegion = region; this.heatmap.setHighlight(region); }
    if (hit) {
      this.onHover?.({ country: hit.country, x: this.pointerPx.x, y: this.pointerPx.y });
    } else if (region) {
      const count = heatPts.filter((p) => p.region === region && p.w > 0.5).length;
      this.onHover?.({ region, count, x: this.pointerPx.x, y: this.pointerPx.y });
    } else if (changed) {
      this.onHover?.(null);
    }
    this.renderer.domElement.style.cursor = hit || region ? "pointer" : "";

    // camera
    if (this.camAnimating) {
      this.camPos.update(now); this.camTarget.update(now);
      this.camera.position.set(this.camPos.x.value, this.camPos.y.value, this.camPos.z.value);
      this.controls.target.set(this.camTarget.x.value, this.camTarget.y.value, this.camTarget.z.value);
      if (this.camPos.done && this.camTarget.done) this.camAnimating = false;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    // CSS2DRenderer assigns z-index by depth each frame; keep pinned (and hovered) labels on top
    for (const m of this.markers.values()) {
      if (!m.label.visible) continue;
      const pinned = this.pinned.has(m.country.iso3) || this.pinnedRegions.has(m.country.region);
      if (pinned) m.label.element.style.zIndex = "100000";
      if (m === this.hovered) m.label.element.style.zIndex = "100001";
      m.label.element.classList.toggle("pinned", pinned);
    }
  }
}
