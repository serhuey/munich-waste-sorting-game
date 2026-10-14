// The explanation shown after an answer. R8 requires one every time — including
// when the answer was right and other destinations were also correct, because
// not knowing the other routes is exactly how someone ends up driving across
// town for something the shop would have taken.

// A label in the asked language, then German, then whatever exists.
export function tx(map, lang) {
  if (!map) return '';
  return map[lang] || map.de || map.en || Object.values(map).find(Boolean) || '';
}

function containerName(strip, id, lang) {
  const found = strip.find(c => c.id === id);
  return found ? tx(found.labels, lang) : id;
}

function placeName(strip, id, lang) {
  const found = strip.find(c => c.id === id);
  return found ? tx(found.placeLabels, lang) : '—';
}

// One line per answered slot: what was chosen, what was right, and — when it was
// wrong — whether the mistake was the place or the container inside it. The two
// are different mistakes and get different sentences (KD7).
export function explainSlot({ strip, slot, chosen, errorKind, fallbackName, lang = 'de' }) {
  const wanted = slot.destinations;
  const ok = !!chosen && wanted.includes(chosen);
  const line = {
    // An unnamed slot is the object itself, so the line says the object's name
    // rather than a machine key nobody chose.
    part: tx(slot.labels, lang) || fallbackName || slot.id,
    ok,
    // Only what is on the belt can be named: a destination in a place not yet
    // unlocked is true, but naming it now would point at something the player
    // cannot see.
    wanted: wanted.filter(id => strip.some(c => c.id === id)).map(id => containerName(strip, id, lang)),
    chosen: chosen ? containerName(strip, chosen, lang) : null,
    also: wanted.filter(id => id !== chosen && strip.some(c => c.id === id)).map(id => containerName(strip, id, lang)),
  };
  if (!ok) {
    line.kind = errorKind;
    const reachable = wanted.find(id => strip.some(c => c.id === id)) || wanted[0];
    line.wantedPlace = placeName(strip, reachable, lang);
    line.chosenPlace = chosen ? placeName(strip, chosen, lang) : null;
  }
  return line;
}

export function reasonText(holder, lang) {
  return tx(holder && holder.explanation, lang);
}

// Three reasons can exist and each answers a different question: the part says
// why that piece goes there, the variant says why this version differs from the
// other one, and the item says what the whole thing teaches. Whichever exist are
// shown, in that order, without repeating one that is identical to another.
export function reasons({ item, variant, slots, lang }) {
  const out = [];
  // A simple variant is its own only slot, so its reason belongs to the variant
  // and must not also be read off the slot — that printed the same paragraph
  // twice. Only a composite variant has parts that can speak for themselves.
  const composite = !!variant && variant.kind === 'composite';
  if (composite) {
    (slots || []).forEach(slot => {
      const text = reasonText(slot, lang);
      if (text) out.push({ scope: tx(slot.labels, lang) || null, text });
    });
  }
  const ofVariant = reasonText(variant, lang);
  if (ofVariant) {
    out.push({ scope: composite ? tx(variant.labels, lang) || null : null,
               text: ofVariant });
  }
  const ofItem = reasonText(item, lang);
  if (ofItem) out.push({ scope: null, text: ofItem });
  // Belt and braces: the same sentence is never worth printing twice, whichever
  // two levels happen to carry it.
  return out.filter((r, i) => out.findIndex(x => x.text === r.text) === i);
}

// A whole item that had to be taken apart and was not: the mistake is not the
// container at all, so the explanation must not talk about containers.
export function explainUndivided(item, variant, lang) {
  return {
    ok: false,
    undivided: true,
    parts: (variant.parts || []).map(p => tx(p.labels, lang) || p.id),
    reasons: reasons({ item, variant, slots: [], lang }),
  };
}

export function explainAnswer({ item, variant, slots, lines, points, lang }) {
  return {
    ok: lines.every(l => l.ok),
    lines,
    points,
    reasons: reasons({ item, variant, slots, lang }),
  };
}
