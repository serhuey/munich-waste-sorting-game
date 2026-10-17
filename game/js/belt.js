// The belt: one continuous strip of containers grouped by place, moving under a
// fixed aim frame. Two controls act on the same strip — a swipe moves container
// by container, a place tab scrolls to the start of a group. The scroll is
// animated on purpose: the strip travels rather than swapping its contents, so
// the player keeps their bearings while something is falling.

export function nearestIndex(centers, x) {
  let best = 0, dist = Infinity;
  centers.forEach((c, i) => {
    const d = Math.abs(c - x);
    if (d < dist) { dist = d; best = i; }
  });
  return best;
}

import { containerSprite, img } from './pixel.js';

// The index in the strip of a place's middle container (the left of the two
// middle ones when the count is even), or -1 for a place not on the strip.
export function middleIndex(strip, placeIndex) {
  const own = strip.map((c, i) => c.placeIndex === placeIndex ? i : -1).filter(i => i >= 0);
  return own.length ? own[Math.floor((own.length - 1) / 2)] : -1;
}

export class Belt {
  constructor({ beltEl, trackEl, tabsEl, onPlaceChange, label }) {
    this.belt = beltEl;
    this.track = trackEl;
    this.tabs = tabsEl;
    this.onPlaceChange = onPlaceChange || (() => {});
    // Labels come in the player's language; the belt asks rather than knowing.
    this.label = label || (map => (map && map.de) || '');
    this.strip = [];
    this.centers = [];
    this.offset = 0;
    this.anim = null;
    this.locked = false;
    this.glides = 0;
    this._bindPointer();
  }

  setStrip(strip, places) {
    this.strip = strip;
    this.track.textContent = '';
    this.tabs.textContent = '';

    const groups = [];
    strip.forEach(c => {
      const last = groups[groups.length - 1];
      if (!last || last.placeId !== c.placeId) groups.push({ placeId: c.placeId, labels: c.placeLabels, containers: [c] });
      else last.containers.push(c);
    });

    groups.forEach((g, gi) => {
      const group = document.createElement('div');
      group.className = 'group';
      const label = document.createElement('div');
      label.className = 'group-label';
      label.textContent = this.label(g.labels);
      const bins = document.createElement('div');
      bins.className = 'bins';
      g.containers.forEach(c => {
        const bin = document.createElement('div');
        bin.className = 'bin';
        bin.dataset.container = c.id;
        // Channels besides colour (R12): the drawing's shape and icon, a texture
        // where two colours share a grey, and the name in words.
        const pic = img(containerSprite(c.id), 'bin-sprite');
        const name = document.createElement('span');
        name.className = 'bin-label';
        name.textContent = this.label(c.labels);
        bin.append(pic, name);
        bins.append(bin);
      });
      group.append(label, bins);
      this.track.append(group);

      // The tab row appears only once a second place exists (R6): with one place
      // there is nothing to switch between, and an empty row teaches nothing.
      if (groups.length > 1) {
        const tab = document.createElement('button');
        tab.className = 'tab';
        tab.type = 'button';
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = gi + 1;
        tab.append(num, document.createTextNode(this.label(g.labels)));
        tab.addEventListener('click', () => this.jumpToPlace(gi));
        this.tabs.append(tab);
      }
    });
    this.tabs.hidden = groups.length < 2;
    this.groups = groups;
    this.index = Math.max(0, this.centreOf(0));
    this.recentre(this.index);
    // Measuring before layout settles gives centres for a width the belt does not
    // have yet, and the strip ends up parked next to the aim frame instead of
    // under it. Re-do it once the browser has laid the row out.
    requestAnimationFrame(() => this.recentre(this.index));
  }

  // Re-measure and put the given container back under the aim frame. Called on
  // every size change, because the frame is fixed and the strip is not.
  recentre(index) {
    this.measure();
    if (!this.centers.length) return;
    this.index = Math.max(0, Math.min(this.centers.length - 1, index));
    this.offset = this.offsetFor(this.index);
    this.render();
  }

  measure() {
    const box = this.track.getBoundingClientRect();
    this.centers = [...this.track.querySelectorAll('.bin')].map(el => {
      const r = el.getBoundingClientRect();
      return r.left - box.left + r.width / 2;
    });
  }

  centerX() { return this.belt.clientWidth / 2; }
  offsetFor(i) { return this.centerX() - (this.centers[i] || 0); }
  activeIndex() { return nearestIndex(this.centers, this.centerX() - this.offset); }
  activeContainer() { return this.strip[this.activeIndex()]; }

  render() {
    this.track.style.transform = 'translateX(' + this.offset + 'px)';
    const active = this.activeContainer();
    [...this.track.querySelectorAll('.bin')].forEach((el, i) => {
      el.classList.toggle('aimed', i === this.activeIndex());
    });
    if (active) {
      [...this.tabs.children].forEach((t, i) => t.classList.toggle('active', i === active.placeIndex));
      if (this._lastPlace !== active.placeId) {
        this._lastPlace = active.placeId;
        this.onPlaceChange(active.placeId);
      }
    }
  }

  glideTo(target, ms) {
    this.index = this.centers.indexOf(this.centerX() - target) >= 0
      ? this.centers.indexOf(this.centerX() - target) : this.index;
    cancelAnimationFrame(this.anim);

    // A hidden tab gets no animation frames, so an animated scroll there would
    // simply never arrive. Nobody is watching it travel anyway.
    if (typeof document !== 'undefined' && document.hidden) {
      this.offset = target;
      this.render();
      this.index = this.activeIndex();
      return;
    }

    const from = this.offset, t0 = performance.now();
    const run = ++this.glides;
    const tick = () => {
      if (run !== this.glides) return;
      const k = Math.min(1, (performance.now() - t0) / ms);
      this.offset = from + (target - from) * (1 - Math.pow(1 - k, 3));
      this.render();
      if (k < 1) this.anim = requestAnimationFrame(tick);
      else this.index = this.activeIndex();
    };
    tick();
    // Frames are not promised (a page saving power, a pane not painting); the
    // belt must still end up where it was sent, or the aim and the picture
    // disagree. If no frame finished the glide, a timer does.
    setTimeout(() => {
      if (run !== this.glides || this.offset === target) return;
      cancelAnimationFrame(this.anim);
      this.offset = target;
      this.render();
      this.index = this.activeIndex();
    }, ms + 120);
  }

  snap() { this.glideTo(this.offsetFor(this.activeIndex()), 120); }

  step(dir) {
    if (this.locked) return;
    const i = Math.max(0, Math.min(this.strip.length - 1, this.activeIndex() + dir));
    this.glideTo(this.offsetFor(i), 110);
  }

  // The container a place opens on: the middle one, not the first. From the
  // middle every other container of that place is at most half the place away,
  // which on the island's six is two steps instead of five. With an even count
  // it is the left of the two middle ones.
  centreOf(placeIndex) { return middleIndex(this.strip, placeIndex); }

  jumpToPlace(placeIndex) {
    if (this.locked) return;
    const i = this.centreOf(placeIndex);
    if (i >= 0) this.glideTo(this.offsetFor(i), 260);
  }

  stepPlace(dir) {
    const active = this.activeContainer();
    if (!active) return;
    const next = active.placeIndex + dir;
    if (next >= 0 && next < this.groups.length) this.jumpToPlace(next);
  }

  _bindPointer() {
    let dragging = false, startX = 0, startOffset = 0, moved = false, tapped = null;
    this.belt.addEventListener('pointerdown', e => {
      if (this.locked) return;
      cancelAnimationFrame(this.anim);
      this.glides++;
      dragging = true; moved = false; startX = e.clientX; startOffset = this.offset;
      // Remembered now: with the pointer captured, the release reports the belt
      // as its target, not the container under the finger.
      const bin = e.target.closest && e.target.closest('.bin');
      tapped = bin ? bin.dataset.container : null;
      try { this.belt.setPointerCapture(e.pointerId); } catch (err) { /* no active pointer */ }
    });
    this.belt.addEventListener('pointermove', e => {
      if (!dragging) return;
      if (Math.abs(e.clientX - startX) > 6) moved = true;
      this.offset = startOffset + (e.clientX - startX);
      this.render();
    });
    // A drag moves the belt by hand; a tap on a container brings that container
    // under the frame — on a phone that is quicker than dragging to it.
    const end = cancelled => {
      if (!dragging) return;
      dragging = false;
      const i = !moved && !cancelled && tapped ? this.strip.findIndex(c => c.id === tapped) : -1;
      if (i >= 0) this.glideTo(this.offsetFor(i), 200);
      else this.snap();
    };
    this.belt.addEventListener('pointerup', () => end(false));
    this.belt.addEventListener('pointercancel', () => end(true));

    // ResizeObserver rather than window.resize: the belt also changes width when
    // the pane around it does, and the aim frame must keep pointing at the same
    // container when it happens.
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.recentre(this.index)).observe(this.belt);
    } else {
      window.addEventListener('resize', () => this.recentre(this.index));
    }
  }
}
