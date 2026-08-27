// Rules derived from data, with no DOM and no globals: everything here is a pure
// function of the content bundle and a date. The 2027 switch lives here and
// nowhere else — containers and destinations carry validity windows, and the
// engine asks these functions what exists today rather than knowing itself.

export function inWindow(thing, date) {
  const from = thing.from ? new Date(thing.from + 'T00:00:00Z') : null;
  const until = thing.until ? new Date(thing.until + 'T00:00:00Z') : null;
  if (from && date < from) return false;
  if (until && date >= until) return false;   // until is exclusive
  return true;
}

// Places with only the containers that stand there on the given date, in belt order.
export function placesOn(places, date) {
  return places
    .filter(p => inWindow(p, date))
    .map(p => ({ ...p, containers: p.containers.filter(c => inWindow(c, date)) }))
    .filter(p => p.containers.length > 0);
}

// One flat strip: the belt is continuous, and a container's index in this array
// is its position under the aim frame.
export function stripOn(places, date) {
  const strip = [];
  placesOn(places, date).forEach((place, placeIndex) => {
    place.containers.forEach(c => {
      strip.push({ ...c, placeId: place.id, placeIndex, placeLabels: place.labels });
    });
  });
  return strip;
}

export function unlockedPlaces(places, date, tier) {
  return placesOn(places, date).filter(p => p.tier <= tier);
}

export function stripForTier(places, date, tier) {
  const allowed = new Set(unlockedPlaces(places, date, tier).map(p => p.id));
  return stripOn(places, date).filter(c => allowed.has(c.placeId));
}

export function itemsForTier(items, tier) {
  return items.filter(i => i.tier === tier);
}

// Destinations a variant accepts today. A destination may be a bare id or an
// object with its own window — that is how one item survives the 2027 switch
// instead of being duplicated into a second item.
export function destinationsOn(holder, date) {
  return (holder.destinations || [])
    .map(d => (typeof d === 'string' ? { id: d } : d))
    .filter(d => inWindow(d, date))
    .map(d => d.id);
}

export function answerSlots(variant, date) {
  if (variant.kind === 'composite') {
    return (variant.parts || []).map(part => ({
      id: part.id,
      labels: part.labels,
      destinations: destinationsOn(part, date)
    }));
  }
  return [{ id: variant.id, labels: variant.labels, destinations: destinationsOn(variant, date) }];
}

// Fall timing. These numbers are the first thing to tune by playing; they are
// deliberately in one place. An item falls slower when it deserves thought
// (borderline) and slower again when its answer is not in the active place,
// because changing place costs an extra action against the same clock.
export const TIMING = { base: 5200, perTier: 250, borderline: 1.35, otherPlace: 1.25 };

export function fallDuration(item, variant, strip, activePlaceId, date) {
  let ms = TIMING.base + (item.tier - 1) * TIMING.perTier;
  if ((item.attrs || []).includes('borderline')) ms *= TIMING.borderline;
  const wanted = new Set(answerSlots(variant, date).flatMap(s => s.destinations));
  const here = strip.some(c => wanted.has(c.id) && c.placeId === activePlaceId);
  if (!here) ms *= TIMING.otherPlace;
  return Math.round(ms);
}

export function placeOfContainer(strip, containerId) {
  const found = strip.find(c => c.id === containerId);
  return found ? found.placeId : null;
}

// A wrong answer is a place error when the player was in the wrong place
// entirely, and a container error when the place was right. The two get
// different explanations, and R25 counts them apart.
export function errorKind(strip, chosenId, correctIds) {
  const chosenPlace = placeOfContainer(strip, chosenId);
  const correctPlaces = new Set(correctIds.map(id => placeOfContainer(strip, id)));
  return correctPlaces.has(chosenPlace) ? 'container' : 'place';
}

export function pickVariant(item) {
  const variants = item.variants || [];
  return variants[Math.floor(Math.random() * variants.length)];
}

export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
