// Text/background pairs from src/app/globals.css must meet 4.5:1 (WCAG AA), composited over the page canvas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = ([r, g, b]) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (rgba, base) => rgba.slice(0, 3).map((c, i) => Math.round(c * rgba[3] + base[i] * (1 - rgba[3])));
const rgba = (s) => { const m = s.match(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/); return [+m[1], +m[2], +m[3], +m[4]]; };

function block(scheme) {
  const text = scheme === 'dark' ? css.slice(css.indexOf('prefers-color-scheme: dark')) : css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'));
  const get = (name) => text.match(new RegExp(`--d-${name}:\\s*([^;]+);`))[1].trim();
  return get;
}

for (const scheme of ['light', 'dark']) {
  test(`contrast ${scheme}`, () => {
    const get = block(scheme);
    // Worst case canvas under the panel: the page canvas, tinted by the brightest accent glow (approximated by the canvas itself).
    const canvas = hex(get('canvas'));
    const panel = over(rgba(get('panel')), canvas);
    const accentSoft = over(rgba(get('accent-soft')), panel);
    const checks = [
      ['ink on panel', hex(get('ink')), panel],
      ['ink-2 on panel', hex(get('ink-2')), panel],
      ['ink-3 on panel', hex(get('ink-3')), panel],
      ['ink-2 on canvas (footer)', hex(get('ink-2')), canvas],
      ['accent-ink on accent-soft', hex(get('accent-ink')), accentSoft],
      ['on-accent on accent (button)', hex(get('on-accent')), hex(get('accent'))],
      ['ok-ink on panel', hex(get('ok-ink')), panel],
      ['warn-ink on panel', hex(get('warn-ink')), panel],
      ['bad-ink on panel', hex(get('bad-ink')), panel],
    ];
    for (const [name, fg, bg] of checks) {
      const r = ratio(fg, bg);
      assert.ok(r >= 4.5, `${scheme}: ${name} is ${r.toFixed(2)}:1`);
    }
  });
}
