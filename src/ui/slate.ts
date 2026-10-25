/**
 * The slate: a pupil works the line by hand before he sets it in type. Chalk follows the pen's
 * pressure where the device gives it (a drawing tablet, a stylus), and a steady line otherwise.
 * Nothing written here leaves the page; it is wiped when the line is entered.
 */
export class Slate {
  private ctx: CanvasRenderingContext2D;
  private drawing = false;
  private last: { x: number; y: number; w: number } | null = null;
  inked = false;
  onInk: () => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.fit();
    new ResizeObserver(() => this.fit()).observe(canvas);
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.move(e));
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) canvas.addEventListener(ev, () => this.up());
    canvas.style.touchAction = "none";
  }

  private fit(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width === w && this.canvas.height === h) return;
    const keep = this.inked ? this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height) : null;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (keep) this.ctx.putImageData(keep, 0, 0);
  }

  private at(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const pressure = e.pointerType === "pen" || e.pointerType === "touch" ? (e.pressure || 0.5) : 0.5;
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: 1.2 + pressure * 3.4 };
  }

  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    this.drawing = true;
    this.last = this.at(e);
    this.dot(this.last);
  }

  private move(e: PointerEvent): void {
    if (!this.drawing || !this.last) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of events.length ? events : [e]) {
      const p = this.at(ce);
      const c = this.ctx;
      c.strokeStyle = "rgba(236, 234, 226, 0.92)";
      c.lineCap = "round";
      c.lineJoin = "round";
      c.lineWidth = (this.last.w + p.w) / 2;
      c.beginPath();
      c.moveTo(this.last.x, this.last.y);
      c.lineTo(p.x, p.y);
      c.stroke();
      this.last = p;
    }
    this.mark();
  }

  private dot(p: { x: number; y: number; w: number }): void {
    this.ctx.fillStyle = "rgba(236, 234, 226, 0.92)";
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.mark();
  }

  private mark(): void {
    if (!this.inked) {
      this.inked = true;
      this.onInk();
    }
  }

  private up(): void {
    this.drawing = false;
    this.last = null;
  }

  wipe(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.inked = false;
  }
}
