// The ladder: five tiers, one place opening at a time, in the order the city
// imposes on someone who has just moved here — the bin in the flat first, the
// shop on the way home, then the island, the yard, and last the drop-off you
// have to plan a trip for.
//
// Pure functions over the content bundle, and no state of its own. Progress is
// held by the caller in memory and written nowhere (KTD3): a ladder that
// survives a reload is progress the player never had to learn, and the run is
// short enough that starting over costs a few minutes rather than an evening.

import { unlockedPlaces, itemsForTier, placesOn } from './rules.js';
import { tierCleared } from './score.js';

// Tier order is data, not a constant here: a place carries the tier it opens
// at, so reordering the ladder is an edit to data/places.json and no edit at
// all to this file.
export function tierOrder(places, date) {
  const tiers = new Set(placesOn(places, date).map(p => p.tier));
  return [...tiers].sort((a, b) => a - b);
}

// A tier can be played only when it has both a place to sort into and something
// verified to sort. The second half is the one that moves: places are complete
// and content is authored item by item, so tiers ahead of the content sit empty
// until they are filled.
export function isPlayable(content, date, tier) {
  const hasPlace = placesOn(content.places, date).some(p => p.tier === tier);
  return hasPlace && itemsForTier(content.items, tier).length > 0;
}

export function ladder(content, date) {
  return tierOrder(content.places, date).filter(t => isPlayable(content, date, t));
}

// The next tier worth entering, skipping any that have no verified items yet.
// Skipping rather than stopping keeps a half-authored ladder playable to its
// end; the skip is named to the player at the tier break, never silent, because
// an unexplained jump from tier 2 to tier 4 reads as a bug.
export function nextPlayable(content, date, tier) {
  return ladder(content, date).find(t => t > tier) ?? null;
}

export function skippedBetween(content, date, fromTier, toTier) {
  return tierOrder(content.places, date)
    .filter(t => t > fromTier && t < toTier && !isPlayable(content, date, t));
}

// Places that open on stepping from one tier to the next — what the player is
// about to be shown, in belt order.
export function placesOpened(places, date, fromTier, toTier) {
  const had = new Set(unlockedPlaces(places, date, fromTier).map(p => p.id));
  return unlockedPlaces(places, date, toTier).filter(p => !had.has(p.id));
}

// What happens at the end of a tier. Three outcomes and no fourth: climb,
// repeat, or the ladder is finished and the tree is next (U7). Failing costs a
// retry and never blocks — the share is the gate, not a clean run (R11).
export function outcome({ content, date, tier, right, answered }) {
  if (!tierCleared(right, answered)) return { kind: 'retry', tier };
  const next = nextPlayable(content, date, tier);
  if (next === null) return { kind: 'finale', tier };
  return { kind: 'advance', tier: next, skipped: skippedBetween(content, date, tier, next),
           opened: placesOpened(content.places, date, tier, next) };
}

// One run, held in memory for as long as the tab is open. Every field is a
// number or a list of numbers: there is nothing here worth persisting even if
// we wanted to.
// The tier being played is the engine's business and lives there; the run keeps
// only what outlives a tier, so there is one answer to "which tier" and not two
// that can drift apart.
export function createRun(startTier = 1) {
  return { startedAt: startTier, points: 0, tiers: [] };
}

export function recordTier(run, { tier, right, answered, points }) {
  const cleared = tierCleared(right, answered);
  // A repeated tier replaces its earlier attempt rather than adding to it: the
  // run total should read as what the player can do, not as what every attempt
  // summed to, and a retry after a bad tier would otherwise be punished twice.
  const tiers = run.tiers.filter(t => t.tier !== tier)
    .concat([{ tier, right, answered, points, cleared }])
    .sort((a, b) => a.tier - b.tier);
  return { ...run, tiers, points: tiers.reduce((sum, t) => sum + t.points, 0) };
}

export function runTotals(run) {
  return run.tiers.reduce((acc, t) => ({
    right: acc.right + t.right, answered: acc.answered + t.answered, points: acc.points + t.points
  }), { right: 0, answered: 0, points: 0 });
}
