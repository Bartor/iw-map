import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { REGION_COLORS } from "./regions";

export interface HeatPoint { x: number; y: number; z: number; w: number; region: string }

/**
 * Region "territory" heatmap: a Gaussian kernel density is computed per region from the
 * visible countries, and each region gets an isosurface covering the volume where it is the
 * most prevalent region and its density exceeds a floor. Field coordinates are 0..1 per axis;
 * world = (field - 0.5) * frameSize.
 */
export class Heatmap {
  group = new THREE.Group();
  private layers = new Map<string, MarchingCubes>();
  private densities = new Map<string, Float32Array>();
  private res = 40;
  /** fraction of the frame edge the field extends beyond the frame on each side */
  static PAD = 0.22;
  private sigma = 0.07;   // kernel width, fraction of the frame edge
  private floor = 0.1;    // min density (in country-peak units); low so adjacent territories meet without gaps
  enabled = false;

  // clip shells to the chart frame (world-space planes at the six faces)
  private clipPlanes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
  ];

  constructor(private frameSize: number) {
    for (const p of this.clipPlanes) p.constant = frameSize / 2 + 0.02;
  }

  private layer(region: string): MarchingCubes {
    let mc = this.layers.get(region);
    if (mc) return mc;
    const color = REGION_COLORS[region] ?? REGION_COLORS.Other;
    const mat = new THREE.MeshPhysicalMaterial({
      color, transparent: true, opacity: 0.32, roughness: 0.55, metalness: 0,
      depthWrite: false, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.3,
      clippingPlanes: this.clipPlanes,
    });
    mc = new MarchingCubes(this.res, mat, false, false, 80000);
    mc.isolation = 0;
    mc.renderOrder = 10;
    mc.scale.setScalar(this.frameSize / 2 * (1 + 2 * Heatmap.PAD));
    mc.userData.region = region;
    mc.visible = this.enabled;
    this.group.add(mc);
    this.layers.set(region, mc);
    return mc;
  }

  /** 0..1 spread control: kernel width from tight to wide. */
  setSpread(t: number) { this.sigma = THREE.MathUtils.lerp(0.035, 0.14, t); }

  /** Meshes for raycasting (only visible ones). */
  get meshes(): THREE.Object3D[] { return [...this.layers.values()].filter((m) => m.visible); }

  /** Emphasise one region shell (null = none). */
  private highlighted: string | null = null;
  private pinned = new Set<string>();

  setHighlight(region: string | null) { this.highlighted = region; this.applyOpacity(); }
  setPinned(regions: Set<string>) { this.pinned = regions; this.applyOpacity(); }

  private applyOpacity() {
    const anyPins = this.pinned.size > 0;
    for (const [r, mc] of this.layers) {
      const base = anyPins ? (this.pinned.has(r) ? 0.45 : 0.14) : 0.32;
      (mc.material as THREE.MeshPhysicalMaterial).opacity = r === this.highlighted ? Math.max(base, 0.55) : base;
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    for (const l of this.layers.values()) l.visible = on;
  }

  update(points: HeatPoint[]) {
    if (!this.enabled) return;
    const N = this.res, N2 = N * N, N3 = N2 * N, S = this.frameSize * (1 + 2 * Heatmap.PAD);
    const sig = this.sigma * N, inv2s2 = 1 / (2 * sig * sig), reach = Math.ceil(sig * 4.5);

    // 1. per-region density
    const active = new Set<string>();
    for (const p of points) {
      if (p.w <= 0.001) continue;
      let d = this.densities.get(p.region);
      if (!d) { d = new Float32Array(N3); this.densities.set(p.region, d); }
      if (!active.has(p.region)) { d.fill(0); active.add(p.region); }
      const cx = (p.x / S + 0.5) * N, cy = (p.y / S + 0.5) * N, cz = (p.z / S + 0.5) * N;
      const x0 = Math.max(1, Math.floor(cx - reach)), x1 = Math.min(N - 2, Math.ceil(cx + reach));
      const y0 = Math.max(1, Math.floor(cy - reach)), y1 = Math.min(N - 2, Math.ceil(cy + reach));
      const z0 = Math.max(1, Math.floor(cz - reach)), z1 = Math.min(N - 2, Math.ceil(cz + reach));
      for (let z = z0; z <= z1; z++) {
        const dz = z - cz;
        for (let y = y0; y <= y1; y++) {
          const dy = y - cy, row = z * N2 + y * N;
          for (let x = x0; x <= x1; x++) {
            const dx = x - cx;
            d[row + x] += p.w * Math.exp(-(dx * dx + dy * dy + dz * dz) * inv2s2);
          }
        }
      }
    }

    // 2. per-region territory field: min(d_r - max_other, d_r - floor)
    const list = [...active];
    const dens = list.map((r) => this.densities.get(r)!);
    for (let i = 0; i < list.length; i++) {
      const mc = this.layer(list[i]);
      mc.reset();
      const f = mc.field, di = dens[i];
      for (let k = 0; k < N3; k++) {
        let other = 0;
        for (let j = 0; j < dens.length; j++) if (j !== i && dens[j][k] > other) other = dens[j][k];
        const v = di[k];
        f[k] = Math.min(v - other, v - this.floor);
      }
      mc.update();
      mc.geometry.computeBoundingSphere();
      mc.visible = true;
    }
    // hide layers for regions with no visible countries
    for (const [r, mc] of this.layers) if (!active.has(r)) mc.visible = false;
  }
}
