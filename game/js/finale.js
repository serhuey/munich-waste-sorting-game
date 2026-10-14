// The Christmas tree: the one object whose answer is not a container (R7).
// A route is its own dimension of data — a window, a year-round flag, or a
// mark that it is not allowed at all — and every route open on the scene's day
// is a right answer. Pure functions: the date is an argument, never a clock.

import { inWindow } from './rules.js';

export const POINTS = { ok: 150, closed: -50, illegal: -100 };

export function routeOpen(route, date) {
  if (route.illegal) return false;
  if (route.year_round) return true;
  return (route.windows || []).some(w => inWindow(w, date));
}

export function openRoutes(finale, date) {
  return finale.routes.filter(r => routeOpen(r, date));
}

// What choosing a route on a given day means. Illegal dumping is named only for
// a place outside every route (R17); a legal route that is closed today is a
// different mistake and is explained by its dates, not by a fine.
export function judge(finale, routeId, date) {
  const route = finale.routes.find(r => r.id === routeId);
  if (!route) return null;
  const open = openRoutes(finale, date);
  if (route.illegal) return { kind: 'illegal', route, open, points: POINTS.illegal };
  if (routeOpen(route, date)) {
    return { kind: 'ok', route, open, also: open.filter(r => r.id !== routeId), points: POINTS.ok };
  }
  return { kind: 'closed', route, open, points: POINTS.closed };
}

// A tree can be routed only once nothing is left on it (AWM: abschmücken und
// von Plastik befreien).
export function stripped(finale, removed) {
  return (finale.decorations || []).every(d => removed.has(d.id));
}

export function sceneDates(finale) {
  return (finale.scenes || []).map(s => new Date(s + 'T12:00:00Z'));
}

// Opening days as the player reads them: "7. Januar – 4. Februar". until is
// exclusive in data and inclusive in speech, so the last day shown is one
// before it.
export function windowText(route, format) {
  return (route.windows || []).map(w => {
    const from = new Date(w.from + 'T12:00:00Z');
    const last = new Date(new Date(w.until + 'T12:00:00Z').getTime() - 86400000);
    return from.getTime() === last.getTime() ? format(from) : format(from) + ' – ' + format(last);
  }).join(', ');
}
