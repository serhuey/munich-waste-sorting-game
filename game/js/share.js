// A result worth forwarding, in one action and with nothing identifying in it
// (R23, KTD8): the score, the bare address, and no source tag — a link opened
// from Reddit and shared onwards must not say it came from Reddit.

export function bareUrl(href) {
  const u = new URL(href);
  return u.origin + u.pathname.replace(/index\.html$/, '');
}

export function payload({ text, href }) {
  return { text, url: bareUrl(href) };
}

// Web Share where the device has it, the clipboard otherwise. Returns what
// happened so the button can say so.
export async function share({ text, url }, nav = navigator) {
  if (nav.share) {
    try { await nav.share({ text, url }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'aborted'; }
  }
  const line = text + ' ' + url;
  try {
    await nav.clipboard.writeText(line);
    return 'copied';
  } catch (e) {
    const area = document.createElement('textarea');
    area.value = line;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand && document.execCommand('copy');
    area.remove();
    return ok ? 'copied' : 'failed';
  }
}
