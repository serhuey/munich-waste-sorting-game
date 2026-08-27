// One item falls at a time. The loop owns nothing but geometry and timing:
// what a landing means is decided by the caller.

export class Fall {
  constructor({ fieldEl, onLanded }) {
    this.field = fieldEl;
    this.onLanded = onLanded;
    this.current = null;
    this.raf = null;
    this.paused = false;
  }

  spawn({ item, variant, duration, label, borderline }) {
    this.clear();
    const el = document.createElement('div');
    el.className = 'item' + (borderline ? ' borderline' : '');
    const glyph = document.createElement('div');
    glyph.className = 'glyph';
    glyph.textContent = (item.attrs || []).includes('separable') ? '❖' : '◆';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = label;
    el.append(glyph, name);
    this.field.append(el);
    this.current = { item, variant, el, started: performance.now(), duration };
    this.el = el;
    this._tick();
  }

  // Fraction of the fall still left, 1 at the top and 0 at the belt. The reward
  // curve in U5 reads this: dropping early is worth more the earlier it is.
  remaining() {
    if (!this.current) return 0;
    const k = (performance.now() - this.current.started) / this.current.duration;
    return Math.max(0, 1 - k);
  }

  drop() {
    if (!this.current || this.paused) return;
    this._land(true);
  }

  clear() {
    cancelAnimationFrame(this.raf);
    if (this.el && this.el.parentNode) this.el.remove();
    this.current = null;
    this.el = null;
  }

  _tick() {
    this.raf = requestAnimationFrame(() => this._tick());
    if (!this.current || this.paused) return;
    const k = (performance.now() - this.current.started) / this.current.duration;
    const travel = this.field.clientHeight + 90;
    this.current.el.style.transform = 'translate(-50%,' + (-90 + k * travel) + 'px)';
    if (k >= 1) this._land(false);
  }

  _land(early) {
    const remaining = this.remaining();
    const { item, variant, el } = this.current;
    cancelAnimationFrame(this.raf);
    this.current = null;
    this.onLanded({ item, variant, el, early, remaining });
  }
}
