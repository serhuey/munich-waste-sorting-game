// One item falls at a time. The loop owns nothing but geometry and timing:
// what a landing means is decided by the caller.

export class Fall {
  constructor({ fieldEl, onLanded, onRelease }) {
    this.field = fieldEl;
    this.onLanded = onLanded;
    // Called the moment an object is let go — before it flies into the bin — so
    // the caller can fix the answer then and there.
    this.onRelease = onRelease || (() => {});
    this.current = null;
    this.raf = null;
    this.paused = false;
    // Two reasons can hold a fall: the player is examining the object, or the
    // page is not on screen. They are kept apart so that coming back to the tab
    // does not end an examination, and ending one does not run a hidden page.
    this.holds = new Set();
    // The fall is timed by the clock, not by frames: a tab left for ten seconds
    // would otherwise come back to an object that "landed" long ago, in whatever
    // bin happened to be under the frame. A hidden page holds the fall.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this._hold('hidden');
        else this._release_hold('hidden', 0);
      });
    }
  }

  // Examining halts the fall so the small print can be read, and then costs a
  // slice of the remaining time. Looking is allowed; looking is not free.
  pause() { this._hold('examine'); }

  resume(penaltyFraction) { this._release_hold('examine', penaltyFraction); }

  _hold(reason) {
    if (!this.current || this.holds.has(reason)) return;
    // The moment is taken here, not in the next frame: a page that draws no
    // frames would otherwise resume from a pause that never started.
    if (!this.holds.size) this.pausedAt = performance.now();
    this.holds.add(reason);
    this.paused = true;
  }

  _release_hold(reason, penaltyFraction) {
    if (!this.current || !this.holds.has(reason)) return;
    this.holds.delete(reason);
    if (penaltyFraction) this.current.started -= penaltyFraction * this.current.duration;
    if (this.holds.size) return;
    this.current.started += performance.now() - this.pausedAt;
    this.paused = false;
  }

  // from: how much of the fall is already behind it, 0 at the top. A part split
  // off an object falls on from the height the object had reached.
  spawn({ item, variant, duration, label, detail, legible, borderline, hint, sprite, part, from = 0 }) {
    this.clear();
    const el = document.createElement('div');
    el.className = 'item' + (borderline ? ' borderline' : '') + (part ? ' part' : '');
    // The card's own transform is rewritten every frame by the fall loop, so
    // anything that wants to move the card has to move this wrapper instead.
    const body = document.createElement('div');
    body.className = 'body';
    const pic = document.createElement('img');
    pic.className = 'sprite';
    pic.src = sprite;
    pic.alt = '';
    pic.draggable = false;
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = label;
    // A borderline object is not marked: a sign saying "the obvious answer is
    // wrong" would hand out the very knowledge the score measures. It only
    // falls slower, which gives time to think without saying why.
    body.append(pic, name);
    if (detail) {
      const small = document.createElement('div');
      small.className = 'detail' + (legible ? '' : ' unreadable');
      small.textContent = detail;
      body.append(small);
    }
    el.append(body);
    if (hint) {
      const tip = document.createElement('div');
      tip.className = 'hint';
      tip.textContent = hint;
      el.append(tip);
    }
    this.field.append(el);
    this.current = { item, variant, el, started: performance.now() - from * duration, duration };
    this.holds.clear();
    this.paused = false;
    if (typeof document !== 'undefined' && document.hidden) this._hold('hidden');
    this.el = el;
    this._tick();
  }

  // Fraction of the fall still left, 1 at the top and 0 at the belt. The reward
  // curve in U5 reads this: dropping early is worth more the earlier it is.
  remaining() {
    if (!this.current) return 0;
    // A held fall is frozen in time, and so is what is left of it.
    const now = this.paused ? this.pausedAt : performance.now();
    const k = (now - this.current.started) / this.current.duration;
    return Math.max(0, 1 - k);
  }

  drop() {
    if (!this.current || this.paused || this.leaving) return;
    this._release(true);
  }

  // How far the object has fallen, 0 at the top and 1 at the belt.
  progress() { return 1 - this.remaining(); }

  // Where the card is inside the field, for whatever wants to take its place.
  box() {
    if (!this.el) return null;
    const f = this.field.getBoundingClientRect(), r = this.el.getBoundingClientRect();
    return { x: r.left - f.left + r.width / 2, y: r.top - f.top + r.height / 2 };
  }

  // A tap that has nothing to answer gets a shrug rather than silence: the
  // object shakes, which says "there is nothing to look at here" without saying
  // anything about the answer.
  nudge() {
    const body = this.el && this.el.querySelector('.body');
    if (!body) return;
    body.classList.remove('nudge');
    void body.offsetWidth;          // restart the animation from the beginning
    body.classList.add('nudge');
    body.addEventListener('animationend', () => body.classList.remove('nudge'), { once: true });
  }

  // Replace the card's contents in place: after examination the same object is
  // still falling, only now its label can be read.
  relabel({ detail, legible, hint, sprite }) {
    if (!this.el) return;
    const pic = this.el.querySelector('.sprite');
    if (pic && sprite) pic.src = sprite;
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
    this.leaving = false;
    this.holds.clear();
    this.paused = false;
  }

  _tick() {
    this.raf = requestAnimationFrame(() => this._tick());
    if (!this.current) return;
    if (this.paused || this.leaving) return;
    const k = (performance.now() - this.current.started) / this.current.duration;
    const travel = this.field.clientHeight - 60;
    this.y = -140 + Math.min(1, k) * travel;
    this.current.el.style.transform = 'translate(-50%,' + this.y + 'px)';
    if (k >= 1) this._release(false);
  }

  // Letting go. The answer and the reward are fixed at this instant; the flight
  // into the bin that follows is only for the eye, so a fast drop is seen
  // landing rather than vanishing into a dialog. It accelerates and shrinks
  // toward the bin under the aim frame, quicker for an object that was already
  // at the belt.
  _release(early) {
    const remaining = this.remaining();
    const { item, variant, el } = this.current;
    this.leaving = true;
    cancelAnimationFrame(this.raf);
    this.onRelease();
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(this.raf);
      this.current = null;
      this.leaving = false;
      this.onLanded({ item, variant, el, early, remaining });
    };
    const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || (typeof document !== 'undefined' && document.hidden)) return done();
    const from = this.y, to = this.field.clientHeight + 10, ms = early ? 280 : 170, t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms), e = t * t;
      el.style.transform = 'translate(-50%,' + (from + (to - from) * e) + 'px) scale(' + (1 - 0.45 * e) + ')';
      if (t < 1) this.raf = requestAnimationFrame(step);
      else done();
    };
    this.raf = requestAnimationFrame(step);
    // Animation frames are not promised: a phone saving power, a window behind
    // another, a pane that is not painting can deliver none at all, and the
    // object would hang above the bin with its answer never counted. A timer
    // lands it anyway, just after the flight would have ended.
    setTimeout(done, ms + 250);
  }
}
