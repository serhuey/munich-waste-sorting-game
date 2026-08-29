// The explanation shown after an answer. R8 requires one every time — including
// when the answer was right and other destinations were also correct, because
// not knowing the other routes is exactly how someone ends up driving across
// town for something the shop would have taken.

const NO_PLACE = { de: '—', en: '—' };

function containerName(strip, id) {
  const found = strip.find(c => c.id === id);
  return found ? found.labels.de : id;
}

function placeName(strip, id) {
  const found = strip.find(c => c.id === id);
  return found ? found.placeLabels.de : NO_PLACE.de;
}

// One line per answered slot: what was chosen, what was right, and — when it was
// wrong — whether the mistake was the place or the container inside it. The two
// are different mistakes and get different sentences (KD7).
export function explainSlot({ strip, slot, chosen, errorKind, fallbackName }) {
  const wanted = slot.destinations;
  const ok = !!chosen && wanted.includes(chosen);
  const line = {
    // An unnamed slot is the object itself, so the line says the object's name
    // rather than a machine key nobody chose.
    part: (slot.labels && slot.labels.de) || fallbackName || slot.id,
    ok,
    wanted: wanted.map(id => containerName(strip, id)),
    chosen: chosen ? containerName(strip, chosen) : null,
    also: wanted.filter(id => id !== chosen).map(id => containerName(strip, id)),
  };
  if (!ok) {
    line.kind = errorKind;
    line.wantedPlace = placeName(strip, wanted[0]);
    line.chosenPlace = chosen ? placeName(strip, chosen) : null;
  }
  return line;
}

export function reasonText(holder, lang) {
  const text = (holder && holder.explanation) || {};
  return text[lang] || text.de || text.en || '';
}

// Three reasons can exist and each answers a different question: the part says
// why that piece goes there, the variant says why this version differs from the
// other one, and the item says what the whole thing teaches. Whichever exist are
// shown, in that order, without repeating one that is identical to another.
export function reasons({ item, variant, slots, lang }) {
  const out = [];
  (slots || []).forEach(slot => {
    const text = reasonText(slot, lang);
    if (text) out.push({ scope: (slot.labels && slot.labels.de) || null, text });
  });
  const ofVariant = reasonText(variant, lang);
  if (ofVariant) out.push({ scope: (variant.labels && variant.labels.de) || null, text: ofVariant });
  const ofItem = reasonText(item, lang);
  if (ofItem && !out.some(r => r.text === ofItem)) out.push({ scope: null, text: ofItem });
  return out;
}

// A whole item that had to be taken apart and was not: the mistake is not the
// container at all, so the explanation must not talk about containers.
export function explainUndivided(item, variant, lang) {
  return {
    ok: false,
    undivided: true,
    parts: (variant.parts || []).map(p => (p.labels && p.labels.de) || p.id),
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
