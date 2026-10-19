/* ------------------------------------------------------------------
   sky.js — the Sky Diary sky engine, ported from Em Time's sky.ts.

   Eight clock-keyed keyframes blended in OKLab, the sun and moon arcs,
   the light/dark polarity snap, and the per-minute contrast check that
   picks the ink for clear glass. The pure parts have no DOM access and
   run in Node for verify.js; applySky / startSky are the only writers.

   Modes: 'sky' follows the clock, 'light' pins 12:30, 'dark' pins 02:30.
   ------------------------------------------------------------------ */

const SKY_KEYFRAMES = [
  //      id           min  [top,      mid,       horizon,   hillBack,  hillFront] [sunIn,    sunOut,    sunGlow,                   moonGlow]                 [cloud,    cloudA, stars]
  kf('latenight',  150, ['#070D22', '#101C40', '#22305E', '#18234A', '#111A3A'], ['#FFD9A0', '#FF7A59', 'rgba(255,140,100,0)',    'rgba(150,170,255,0.35)'], ['#4A578A', 0.18, 1]),
  kf('dawn',       360, ['#A9CBF0', '#F6CFD6', '#FFDDB5', '#B9D3EE', '#9CC0E6'], ['#FFF1C9', '#FFB46B', 'rgba(255,180,107,0.55)', 'rgba(150,170,255,0.15)'], ['#FFF4F0', 0.9,  0.15]),
  kf('morning',    510, ['#6EB8F2', '#A9D8FA', '#E3F3FD', '#C6E9E4', '#A8DCD4'], ['#FFFBE6', '#FFD86B', 'rgba(255,236,170,0.60)', 'rgba(150,170,255,0)'],    ['#FFFFFF', 1,    0]),
  kf('midday',     750, ['#4FA8EE', '#8CC8F5', '#D6EEFC', '#BFE6D9', '#9FD6C6'], ['#FFFDF0', '#FFE07A', 'rgba(255,244,190,0.65)', 'rgba(150,170,255,0)'],    ['#FFFFFF', 1,    0]),
  kf('afternoon',  960, ['#5AA7E6', '#A3CDEF', '#FBE3C6', '#C3E2D2', '#A6D2BD'], ['#FFF4D6', '#FFC861', 'rgba(255,214,140,0.60)', 'rgba(150,170,255,0)'],    ['#FFFDF8', 0.95, 0]),
  kf('dusk',      1110, ['#363F88', '#7D5596', '#F09A7E', '#5A4F8E', '#463F7A'], ['#FFD9A0', '#FF7A59', 'rgba(255,140,100,0.55)', 'rgba(190,180,255,0.30)'], ['#F6C3D0', 0.7,  0.35]),
  kf('evening',   1230, ['#1E2A5E', '#34407E', '#6B5A94', '#2A3468', '#222B58'], ['#FFD9A0', '#FF7A59', 'rgba(255,140,100,0)',    'rgba(170,190,255,0.45)'], ['#7C88BC', 0.35, 0.8]),
  kf('night',     1380, ['#0B1430', '#16244D', '#2B3D73', '#1A2A55', '#142147'], ['#FFD9A0', '#FF7A59', 'rgba(255,140,100,0)',    'rgba(159,180,255,0.40)'], ['#56639A', 0.22, 1])
];

function kf(id, atMin, sky, sun, cloud) {
  return {
    id, atMin,
    top: sky[0], mid: sky[1], horizon: sky[2], hillBack: sky[3], hillFront: sky[4],
    sunInner: sun[0], sunOuter: sun[1], sunGlow: sun[2], moonGlow: sun[3],
    cloudFill: cloud[0], cloudOpacity: cloud[1], starOpacity: cloud[2]
  };
}

/* Polarity: light from 05:15 to 16:59, dark otherwise. */
const POLARITY_FLIP_MIN = { toLight: 315, toDark: 1020 };
const SKY_INK = { dark: '#10263F', light: '#FFFFFF' };   // navy on light skies, white on dark
const GLASS_INK = { navy: '#10263F', white: '#EEF5FF' };

const PIN_LIGHT = 750;   // 12:30
const PIN_DARK = 150;    // 02:30, the deepest night

/* ---- colour math ---------------------------------------------- */

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToLab(hex) {
  const [R, G, B] = hexToRgb(hex);
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const r = lin(R), g = lin(G), b = lin(B);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}

function labToHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ].map(c => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  });
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/* Blend two hex colours in OKLab, so dusk into evening never greys out. */
function mixHex(a, b, t) {
  if (t <= 0) return a.toUpperCase();
  if (t >= 1) return b.toUpperCase();
  const A = hexToLab(a), B = hexToLab(b);
  return labToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

const num = (a, b, t) => a + (b - a) * t;
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

function parseRgba(c) {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  const p = (m ? m[1] : '0,0,0,1').split(',').map(x => parseFloat(x));
  return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]];
}

function mixRgba(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const A = parseRgba(a), B = parseRgba(b);
  const r = A.map((v, i) => num(v, B[i], t));
  return `rgba(${Math.round(r[0])},${Math.round(r[1])},${Math.round(r[2])},${round(r[3])})`;
}

function relLum(hex) {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* WCAG contrast ratio of two opaque hex colours. */
function contrastRatio(fg, bg) {
  const a = relLum(fg), b = relLum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* Alpha-composite an rgba() colour over an opaque hex; returns opaque hex. */
function composite(rgba, under) {
  const [r, g, b, a] = parseRgba(rgba);
  const [R, G, B] = hexToRgb(under);
  const f = (s, u) => Math.round(s * a + u * (1 - a));
  return '#' + [f(r, R), f(g, G), f(b, B)].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/* Straight sRGB lerp, used only to sample the sky gradient at a height. */
function lerpHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/* ---- clear glass ----------------------------------------------- */

const GLASS_TARGET = 4.6;   // above the 4.5:1 floor so rounding cannot tip it under
const GLASS_ZONES = { top: [0, 0.2, 0.3, 0.4], low: [0.55, 0.7, 0.8, 0.85] };
/* White the glass itself adds under a label: plain, then selected/hovered, per polarity. */
const GLASS_LIFT = { light: [0.06, 0.4], dark: [0.04, 0.23] };

/* Clear glass keeps almost nothing under its labels, so the ink is picked
   per minute — navy or white, whichever needs the thinner help — plus a
   scrim of the opposite tone only where neither reaches 4.5:1 on its own. */
function glassFor(sky, polarity, preferNavy, zone) {
  const under = GLASS_ZONES[zone].map(y =>
    y <= 0.55 ? lerpHex(sky.top, sky.mid, y / 0.55) : lerpHex(sky.mid, sky.horizon, (y - 0.55) / 0.45));
  const [plain, bead] = GLASS_LIFT[polarity];
  const order = preferNavy ? ['navy', 'white'] : ['white', 'navy'];
  let best = { ink: GLASS_INK.navy, scrim: 'transparent', alpha: Infinity };
  for (const tone of order) {
    const ink = GLASS_INK[tone];
    const base = tone === 'navy' ? '255,255,255' : '8,16,40';
    const lift = tone === 'navy' ? plain : bead;
    for (let a = 0; a <= 0.7001 && a < best.alpha; a += 0.05) {
      const alpha = Math.round(a * 100) / 100;
      const ok = under.every(u =>
        contrastRatio(ink, composite(`rgba(255,255,255,${lift})`,
          alpha ? composite(`rgba(${base},${alpha})`, u) : u)) >= GLASS_TARGET);
      if (ok) {
        best = { ink, scrim: alpha ? `rgba(${base},${alpha})` : 'transparent', alpha };
        break;
      }
    }
  }
  return { ink: best.ink, scrim: best.scrim };
}

/* ---- state ------------------------------------------------------ */

function polarityAt(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return m >= POLARITY_FLIP_MIN.toLight && m < POLARITY_FLIP_MIN.toDark ? 'light' : 'dark';
}

/* Nearest keyframe by circular distance; ties go to the later one. */
function nearestPhase(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  let best = SKY_KEYFRAMES[0], bestD = Infinity, bestAhead = false;
  for (const k of SKY_KEYFRAMES) {
    const forward = (k.atMin - m + 1440) % 1440;
    const d = Math.min(forward, 1440 - forward);
    const ahead = forward <= 720;
    if (d < bestD || (d === bestD && ahead && !bestAhead)) { best = k; bestD = d; bestAhead = ahead; }
  }
  return best.id;
}

const SUN_START = 330;    // 05:30
const SUN_SPAN = 840;     // to 19:30
const MOON_START = 1140;  // 19:00
const MOON_SPAN = 690;    // to 06:30 next day
const FADE_MIN = 20;

function body(elapsed, span) {
  if (elapsed < 0 || elapsed > span) return { visible: false, p: 0, opacity: 0 };
  const opacity = Math.min(1, elapsed / FADE_MIN, (span - elapsed) / FADE_MIN);
  return { visible: true, p: elapsed / span, opacity: Math.max(0, opacity) };
}

/* Lunar phase from the mean synodic month, anchored at the 2000-01-06 new moon. */
function moonPhase(now) {
  const SYNODIC = 29.530588853;
  const days = (now.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  return { illumination: (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2, waxing: age < SYNODIC / 2 };
}

/* Pure: the whole sky at a local clock time. `date` only drives the moon phase. */
function skyAt(minutes, date = new Date()) {
  const t = ((minutes % 1440) + 1440) % 1440;
  const n = SKY_KEYFRAMES.length;
  let ai = n - 1;
  for (let i = 0; i < n; i++) if (SKY_KEYFRAMES[i].atMin <= t) ai = i;
  const A = SKY_KEYFRAMES[ai], B = SKY_KEYFRAMES[(ai + 1) % n];
  const aAt = A.atMin <= t ? A.atMin : A.atMin - 1440;
  const bAt = B.atMin > aAt ? B.atMin : B.atMin + 1440;
  const k = (t - aAt) / (bAt - aAt);

  const top = mixHex(A.top, B.top, k);
  const mid = mixHex(A.mid, B.mid, k);
  const horizon = mixHex(A.horizon, B.horizon, k);
  const ink = Math.min(contrastRatio(SKY_INK.dark, top), contrastRatio(SKY_INK.dark, mid)) >=
              Math.min(contrastRatio(SKY_INK.light, top), contrastRatio(SKY_INK.light, mid))
    ? SKY_INK.dark : SKY_INK.light;
  const polarity = polarityAt(t);
  const navy = ink === SKY_INK.dark;
  const glass = glassFor({ top, mid, horizon }, polarity, navy, 'top');
  const glassLow = glassFor({ top, mid, horizon }, polarity, navy, 'low');
  const moonElapsed = t >= MOON_START ? t - MOON_START : t + 1440 - MOON_START;

  return {
    minutes: t, phase: nearestPhase(t), polarity,
    top, mid, horizon,
    hillBack: mixHex(A.hillBack, B.hillBack, k),
    hillFront: mixHex(A.hillFront, B.hillFront, k),
    sunInner: mixHex(A.sunInner, B.sunInner, k),
    sunOuter: mixHex(A.sunOuter, B.sunOuter, k),
    sunGlow: mixRgba(A.sunGlow, B.sunGlow, k),
    moonGlow: mixRgba(A.moonGlow, B.moonGlow, k),
    cloudFill: mixHex(A.cloudFill, B.cloudFill, k),
    cloudOpacity: round(num(A.cloudOpacity, B.cloudOpacity, k)),
    starOpacity: round(num(A.starOpacity, B.starOpacity, k)),
    ink,
    glassInk: glass.ink, glassScrim: glass.scrim,
    glassInkLow: glassLow.ink, glassScrimLow: glassLow.scrim,
    sun: body(t - SUN_START, SUN_SPAN),
    moon: Object.assign(body(moonElapsed, MOON_SPAN), moonPhase(date))
  };
}

/* The sky for a theme mode. */
function skyFor(mode, now) {
  if (mode === 'light') return skyAt(PIN_LIGHT, now);
  if (mode === 'dark') return skyAt(PIN_DARK, now);
  return skyAt(now.getHours() * 60 + now.getMinutes(), now);
}

/* Back hill height: clamp(84px, 18vh, 170px). */
const backHillHeight = vh => Math.min(170, Math.max(84, vh * 0.18));

/* Body centre and size for a viewport. Rises left, sets right, sinks behind the back hill. */
function arcPosition(p, vw, vh, kind) {
  const desktop = vw >= 900;
  const size = kind === 'sun' ? (desktop ? 88 : 64) : (desktop ? 64 : 48);
  const horizon = vh - backHillHeight(vh) + size * 0.35;
  const apex = desktop ? 296 : (kind === 'moon' ? Math.max(180, horizon - 56) : 180);
  const x = vw * (0.06 + 0.88 * p);
  const y = horizon - Math.sin(Math.PI * p) * Math.max(0, horizon - apex);
  return { x, y, size };
}

/* ---- DOM writer ------------------------------------------------- */

const px = n => `${Math.round(n * 10) / 10}px`;

/* Writes the sky custom properties and html attributes, and syncs theme-color. */
function applySky(state, root = document.documentElement) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const set = (k, v) => root.style.setProperty(k, v);
  set('--sky-top', state.top);
  set('--sky-mid', state.mid);
  set('--sky-horizon', state.horizon);
  set('--sky-hill-back', state.hillBack);
  set('--sky-hill-front', state.hillFront);
  set('--sky-ink', state.ink);
  set('--sky-ink-shadow', state.ink === SKY_INK.dark ? 'rgba(255,255,255,0.5)' : 'rgba(10,22,50,0.5)');
  set('--sky-lg-ink', state.glassInk);
  set('--sky-lg-scrim', state.glassScrim);
  set('--sky-lg-ink-low', state.glassInkLow);
  set('--sky-lg-scrim-low', state.glassScrimLow);
  set('--sky-sun-inner', state.sunInner);
  set('--sky-sun-outer', state.sunOuter);
  set('--sky-sun-glow', state.sunGlow);
  set('--sky-moon-glow', state.moonGlow);
  set('--sky-cloud-fill', state.cloudFill);
  set('--sky-cloud-opacity', String(state.cloudOpacity));
  set('--sky-star-opacity', String(state.starOpacity));
  set('--sky-star-vis', state.starOpacity > 0 ? 'visible' : 'hidden');

  const sun = arcPosition(state.sun.p, vw, vh, 'sun');
  set('--sky-sun-x', px(sun.x));
  set('--sky-sun-y', px(sun.y));
  set('--sky-sun-size', px(sun.size));
  set('--sky-sun-opacity', String(round(state.sun.opacity)));
  set('--sky-sun-display', state.sun.visible ? 'block' : 'none');

  const moon = arcPosition(state.moon.p, vw, vh, 'moon');
  set('--sky-moon-x', px(moon.x));
  set('--sky-moon-y', px(moon.y));
  set('--sky-moon-size', px(moon.size));
  set('--sky-moon-opacity', String(round(state.moon.opacity)));
  set('--sky-moon-display', state.moon.visible ? 'block' : 'none');
  /* the terminator: how far the shade disc slides off the moon, and which way */
  set('--sky-moon-illum', String(round(state.moon.illumination)));
  set('--sky-moon-waxing', state.moon.waxing ? '1' : '-1');

  root.dataset.theme = state.polarity;
  root.dataset.skyPhase = state.phase;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.top);
}

let currentMode = () => 'sky';

/* Recompute and write right now (after a theme change, visibility change or resize). */
function refreshSky() {
  const mode = currentMode();
  document.documentElement.dataset.themeMode = mode;
  applySky(skyFor(mode, new Date()));
}

/* Writes now, then once a minute on the minute, again when the tab becomes
   visible, and (debounced) on resize. Returns a stop function. */
function startSky(getMode) {
  currentMode = getMode;
  const root = document.documentElement;
  let timer = 0, resizeTimer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { refreshSky(); schedule(); }, 60000 - (Date.now() % 60000) + 30);
  };
  const onVisibility = () => {
    root.toggleAttribute('data-hidden', document.hidden);
    if (!document.hidden) { refreshSky(); schedule(); }
  };
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(refreshSky, 150); };
  root.toggleAttribute('data-hidden', document.hidden);
  refreshSky();
  schedule();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);
  return () => {
    clearTimeout(timer); clearTimeout(resizeTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
  };
}

/* ---- scene --------------------------------------------------------
   The engine only writes variables; this is the one bit of scene
   drawing that needs JavaScript: a scatter of stars from a seeded PRNG
   so the sky looks the same on every visit. Everything else is markup
   in index.html and CSS.
   ------------------------------------------------------------------ */
function buildStars(container, count) {
  let seed = 0x5eed;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const s = document.createElement('i');
    const size = 1 + rand() * 1.6;
    s.style.cssText = `left:${(rand() * 100).toFixed(2)}%;top:${(rand() * 62).toFixed(2)}%;` +
      `width:${size.toFixed(2)}px;height:${size.toFixed(2)}px;` +
      `animation-delay:${(-rand() * 5).toFixed(2)}s;animation-duration:${(3 + rand() * 2).toFixed(2)}s`;
    frag.appendChild(s);
  }
  container.replaceChildren(frag);
}
