export type Ease = (t: number) => number;
export const easeInOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);

/** A scalar that eases toward a target when retargeted. */
export class Anim {
  private from: number;
  private to: number;
  private t0 = 0;
  private cur: number;
  constructor(v: number, public duration = 900, public ease: Ease = easeInOutCubic) {
    this.from = this.to = this.cur = v;
  }
  get target() { return this.to; }
  get value() { return this.cur; }
  set(target: number, now = performance.now(), duration = this.duration) {
    if (target === this.to) return;
    this.from = this.cur;
    this.to = target;
    this.t0 = now;
    this.duration = duration;
  }
  jump(v: number) { this.from = this.to = this.cur = v; }
  update(now: number): number {
    if (this.cur === this.to) return this.cur;
    const t = Math.min(1, (now - this.t0) / this.duration);
    this.cur = this.from + (this.to - this.from) * this.ease(t);
    if (t >= 1) this.cur = this.to;
    return this.cur;
  }
  get done() { return this.cur === this.to; }
}

export class Anim3 {
  x: Anim; y: Anim; z: Anim;
  constructor(x = 0, y = 0, z = 0, duration = 900, ease: Ease = easeInOutCubic) {
    this.x = new Anim(x, duration, ease);
    this.y = new Anim(y, duration, ease);
    this.z = new Anim(z, duration, ease);
  }
  set(x: number, y: number, z: number, now = performance.now(), duration?: number) {
    this.x.set(x, now, duration); this.y.set(y, now, duration); this.z.set(z, now, duration);
  }
  jump(x: number, y: number, z: number) { this.x.jump(x); this.y.jump(y); this.z.jump(z); }
  update(now: number) { this.x.update(now); this.y.update(now); this.z.update(now); }
  get done() { return this.x.done && this.y.done && this.z.done; }
}
