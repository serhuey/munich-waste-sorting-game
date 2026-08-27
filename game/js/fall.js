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

  // Examining halts the fall so the small print can be read, and then costs a
  // slice of the remaining time. Looking is allowed; looking is not free.
  pause() { this.paused = true; }

  resume(penaltyFraction) {
    if (!this.current) return;
    const paused = performance.now() - this.pausedAt;
    this.current.started += paused - (penaltyFraction || 0) * this.current.duration;
    this.paused = false;
  }

  spawn({ item, variant, duration, label, detail, legible, borderline, hint }) {
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
    if (detail) {
      const small = document.createElement('div');
      small.className = 'detail' + (legible ? '' : ' unreadable');
      small.textContent = detail;
      el.append(small);
    }
    if (hint) {
      const tip = document.createElement('div');
      tip.className = 'hint';
      tip.textContent = hint;
      el.append(tip);
    }
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

  // Replace the card's contents in place: after examination the same object is
  // still falling, only now its label can be read.
  relabel({ detail, legible, hint }) {
    if (!this.el) return;
    const small = this.el.querySelector('.detail');
    if (small) {
      small.textContent = detail || '';
      small.classList.toggle('unreadable', !legible);
    }
    const tip = this.el.querySelector('.hint');
    if (tip) { if (hint) tip.textContent = hint; else tip.remove(); }
  }

  clear() {
    cancelAnimationFrame(this.raf);
    if (this.el && this.el.parentNode) this.el.remove();
    this.current = null;
    this.el = null;
  }

  _tick() {
    this.raf = requestAnimationFrame(() => this._tick());
    if (!this.current) return;
    if (this.paused) { this.pausedAt = this.pausedAt || performance.now(); return; }
    this.pausedAt = 0;
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
