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

// A slot carries its own reason when the data has one: why this part goes where
// it goes is not the same sentence as why the object as a whole works this way.
export function answerSlots(variant, date) {
  if (variant.kind === 'composite') {
    return (variant.parts || []).map(part => ({
      id: part.id,
      labels: part.labels,
      explanation: part.explanation || null,
      destinations: destinationsOn(part, date)
    }));
  }
  return [{ id: variant.id, labels: variant.labels,
            explanation: variant.explanation || null,
            destinations: destinationsOn(variant, date) }];
}

// Fall timing. These numbers are the first thing to tune by playing; they are
// deliberately in one place. An item falls slower when it deserves thought
// (borderline) and slower again when its answer is not in the active place,
// because changing place costs an extra action against the same clock.
export const TIMING = { base: 5200, perTier: 250, borderline: 1.35, otherPlace: 1.25,
                        examineCost: 0.15 };

// destinations is a plain list of container ids: a whole item passes its
// variant's, a part passes its own, and neither needs to know about the other.
export function fallDuration(item, destinations, strip, activePlaceId) {
  let ms = TIMING.base + (item.tier - 1) * TIMING.perTier;
  if ((item.attrs || []).includes('borderline')) ms *= TIMING.borderline;
  const wanted = new Set(destinations);
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

export function needsExamination(item) {
  return (item.attrs || []).includes('examine');
}

export function variantNeedsSplit(variant) {
  return variant.kind === 'composite';
}

// What the player can read on the falling card. Before examination the variant
// is deliberately unreadable — the answer is printed on the object in small
// type, and going to look at it is the move R4 is about.
export function visibleLabel(item, variant, examined) {
  const name = (item.labels && item.labels.de) || item.id;
  // Only a named variant has anything to show under the name: with one version
  // of the object there is nothing to tell apart, and repeating its name there
  // would be noise pretending to be information.
  const detail = (variant && variant.labels && variant.labels.de) || '';
  const legible = !needsExamination(item) || examined;
  return { name, detail, legible: detail ? legible : true };
}

// What a tap on the object does right now. Never "drop": the gesture that looks
// at a thing must not be the gesture that throws it away, and an object with
// nothing to examine and nothing to take apart simply does not answer the tap.
export function tapAction(round) {
  if (!round) return 'none';
  if (!round.examined) return 'examine';
  if (variantNeedsSplit(round.variant) && !round.split) return 'split';
  return 'none';
}

// Parts are answered one at a time and the order does not matter (R5): scoring
// is a lookup by slot, never a comparison of sequences.
export function scoreSlots(slots, answers, date) {
  let right = 0;
  const detail = slots.map(slot => {
    const chosen = answers[slot.id];
    const wanted = slot.destinations && slot.destinations.length
      ? slot.destinations : destinationsOn(slot, date);
    const ok = wanted.includes(chosen);
    if (ok) right += 1;
    return { id: slot.id, chosen, wanted, ok };
  });
  return { right, total: slots.length, detail };
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
