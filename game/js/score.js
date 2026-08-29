// Scoring. Every number here is a starting value to be tuned by playing, not a
// result of analysis — they live together so that tuning is one edit.
//
// The shape is what matters: time is a resource spent only on doubt. Answering
// early is worth more the earlier it is, and being wrong early costs more than
// being wrong slowly, so the score measures not what a player remembers but
// what they know they know (KD6, R10).

export const POINTS = {
  correct: 100,
  wrong: -50,
  earlyBonus: 0.5,      // a correct drop with the whole fall left is worth 150
  earlyPenalty: 0.5,    // a wrong one with the whole fall left costs 75
};

export const CLEAR_SHARE = 0.7;   // R11: a tier is cleared on a share, never on a clean run

// remaining is 1 at the top of the screen and 0 at the belt.
export function scoreAnswer({ ok, early, remaining }) {
  const left = early ? Math.max(0, Math.min(1, remaining)) : 0;
  return ok
    ? Math.round(POINTS.correct * (1 + POINTS.earlyBonus * left))
    : Math.round(POINTS.wrong * (1 + POINTS.earlyPenalty * left));
}

// R9: taking an item apart must never score lower than sending the same item
// whole. Without this floor a two-part item sorted entirely wrongly costs twice
// what not bothering costs, and the game would be teaching players not to try.
export function splitFloor(partsTotal, wholeAlternative) {
  return Math.max(partsTotal, wholeAlternative);
}

export function tierCleared(right, answered) {
  if (!answered) return false;
  return right / answered >= CLEAR_SHARE;
}

export function sharePercent(right, answered) {
  return answered ? Math.round((right / answered) * 100) : 0;
}
