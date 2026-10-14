// Interface strings and rule content are separate stores (R21). Strings come
// from data/i18n/<lang>.json through the build; rule content carries its own
// languages. Adding a language is adding a file: the list here is whatever the
// bundle holds, and no line of code names a language except the fallback.

export function preferredLanguage(asked, browser, available) {
  const fits = l => l && available.includes(l.slice(0, 2).toLowerCase()) ? l.slice(0, 2).toLowerCase() : null;
  if (fits(asked)) return fits(asked);
  for (const l of browser || []) if (fits(l)) return fits(l);
  return available.includes('de') ? 'de' : available[0];
}

export function createI18n(bundle, lang) {
  const langs = Object.keys(bundle || {});
  let current = langs.includes(lang) ? lang : (langs.includes('de') ? 'de' : langs[0]);
  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));
  return {
    langs,
    get lang() { return current; },
    set(l) { if (langs.includes(l)) current = l; },
    name: l => (bundle[l] && bundle[l]._language) || l,
    // A key missing from one language falls back to German rather than showing
    // the key; the build refuses such a bundle anyway, this is belt and braces.
    t(key, vars) {
      const s = (bundle[current] && bundle[current][key]) ?? (bundle.de && bundle.de[key]) ?? key;
      return fill(s, vars);
    },
    // Rule content: the current language, then German (the source language),
    // then English, then anything at all — never an empty label.
    pick(map) {
      if (!map) return '';
      return map[current] || map.de || map.en || Object.values(map).find(Boolean) || '';
    },
    date(d, opts) {
      const locale = current === 'de' ? 'de-DE' : current === 'en' ? 'en-GB' : current;
      return new Intl.DateTimeFormat(locale, opts || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
    },
  };
}
