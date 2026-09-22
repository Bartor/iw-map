import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Country, Dim } from "./types";
import { Anim, Anim3, easeOutCubic } from "./tween";
import { REGION_COLORS } from "./regions";

const S = 10;            // frame edge length in world units
const GRID_N = 10;       // grid subdivisions per face
const MARKER_R = 0.13;

interface Marker {
  country: Country;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  label: CSS2DObject;
  pos: Anim3;      // frame-local position, 0..S per axis
  scale: Anim;     // 0 hidden .. 1 visible
  visible: boolean;
}

export interface HoverInfo { country: Country; x: number; y: number }

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

  private camPos = new Anim3(0, 0, 0, 1100, easeOutCubic);
  private camTarget = new Anim3(0, 0, 0, 1100, easeOutCubic);
  private camAnimating = false;
  private lastNdims = -1;

  onHover: ((info: HoverInfo | null) => void) | null = null;

  constructor(private container: HTMLElement, countries: Country[]) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x0b0e14, 1);
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    Object.assign(this.labelRenderer.domElement.style, { position: "absolute", top: "0", left: "0", pointerEvents: "none" });
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

    for (const c of countries) this.addMarker(c);

    this.renderer.domElement.addEventListener("pointermove", (e) => {
      const r = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pointerPx = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    this.renderer.domElement.addEventListener("pointerleave", () => { this.pointer.set(-10, -10); });

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop((t) => this.tick(t));
  }

  private addMarker(country: Country) {
    const color = REGION_COLORS[country.region] ?? REGION_COLORS.Other;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, emissive: color, emissiveIntensity: 0.15 });
    const mesh = new THREE.Mesh(this.sphereGeo, mat);
    mesh.scale.setScalar(0.0001);
    mesh.userData.iso3 = country.iso3;
    const label = makeLabel("label", country.name);
    label.visible = false;
    mesh.add(label);
    this.markerGroup.add(mesh);
    this.markers.set(country.iso3, { country, mesh, label, pos: new Anim3(0, 0, 0), scale: new Anim(0, 500, easeOutCubic), visible: false });
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

  setLabels(on: boolean) { this.showLabels = on; }
  setAutoRotate(on: boolean) { this.controls.autoRotate = on; }

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

  /** Which countries currently have data for every active axis. */
  hasAllValues(c: Country): boolean {
    return this.axes.every((d) => !d || d.id in c.values);
  }

  private retarget(now: number) {
    const axisKeys = ["x", "y", "z"] as const;
    for (const m of this.markers.values()) {
      const c = m.country;
      const show = this.selection.has(c.iso3) && this.hasAllValues(c) && this.ndims > 0;
      const coord = (i: number) => {
        const d = this.axes[i];
        if (!d) return 0;
        const v = c.values[d.id];
        if (v === undefined) return m.pos[axisKeys[i]].target;
        return ((v - d.min) / (d.max - d.min)) * S;
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
    for (const m of this.markers.values()) {
      m.pos.update(now); m.scale.update(now);
      const s = m.scale.value;
      const hov = m === this.hovered ? 1.6 : 1;
      m.mesh.position.set(off.x + m.pos.x.value, off.y + m.pos.y.value, off.z + m.pos.z.value);
      m.mesh.scale.setScalar(Math.max(s * hov, 1e-4));
      m.mesh.visible = s > 0.001;
      m.label.visible = this.showLabels && s > 0.6;
      m.label.element.style.opacity = String(s);
    }

    // hover
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.markerGroup.children.filter((o) => o.visible), false);
    const hit = hits[0] ? this.markers.get(hits[0].object.userData.iso3) ?? null : null;
    if (hit !== this.hovered) {
      this.hovered = hit;
      this.onHover?.(hit ? { country: hit.country, x: this.pointerPx.x, y: this.pointerPx.y } : null);
      this.renderer.domElement.style.cursor = hit ? "pointer" : "";
    } else if (hit) {
      this.onHover?.({ country: hit.country, x: this.pointerPx.x, y: this.pointerPx.y });
    }

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
  }
}
