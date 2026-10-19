/* ------------------------------------------------------------------
   app.js — screens, question generation, scoring and progress.
   ------------------------------------------------------------------ */

const ROUND_LEN = 12;
const GAUNTLET_SECONDS = 90;

/* ------------------------------------------------------------ yield

   Every question variant carries a tier. These are judgement calls
   about how often the topic actually turns up, not an official AAMC
   ranking — the Gauntlet's setting is the ceiling.

   HI  core content that appears on nearly every exam
   MED genuinely tested, but more specific
   LOW true and worth knowing, rarely examined

   The reference table ignores this entirely and always shows all of it.
   ------------------------------------------------------------------ */
const HI = 1, MED = 2, LOW = 3;

/* These describe the Gauntlet only. The other modes always run at full
   coverage no matter what this is set to. */
const YIELD_LEVELS = [
  { name: 'High yield',
    blurb: 'Only what turns up on nearly every exam: structures, one-letter codes, side-chain classes, charge at physiological pH, and the rule for finding a pI.' },
  { name: 'Exam scope',
    blurb: 'Everything the AAMC actually tests: adds three-letter codes, functional groups, pI estimation and gel migration.' },
  { name: 'Everything',
    blurb: 'Adds the rarely-examined long tail. The other modes always cover everything, whatever this is set to.' }
];

/* The setting governs the Gauntlet and nothing else. Outside it this flag
   is false, the ceiling opens to LOW, and every standalone mode serves
   its full range of questions. */
let yieldActive = false;

function yieldCap() { return yieldActive ? S.yield + 1 : LOW; }

/* Keep only items at or below the ceiling, never returning nothing. */
function atYield(items) {
  const ok = items.filter(i => i.y <= yieldCap());
  return ok.length ? ok : items;
}

/* -------------------------------------------------------------- icons
   20px stroke icons in currentColor, per the Button spec. */
const ICON = {
  hexagon: '<path d="M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  sliders: '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/>',
  balance: '<path d="M12 3v18M8 21h8M4 7h16M6 7l-3 7a3 3 0 0 0 6 0L6 7zM18 7l-3 7a3 3 0 0 0 6 0l-3-7z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18V3z" fill="currentColor" stroke="none"/>'
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
}

const MODES = [
  { id: 'struct2name', icon: 'hexagon', name: 'Structure → Name',
    desc: 'See a skeletal structure, name the amino acid.' },
  { id: 'name2struct', icon: 'search', name: 'Name → Structure',
    desc: 'Given the name, pick the right side chain out of four.' },
  { id: 'codes', icon: 'type', name: 'Abbreviations',
    desc: 'Type the one- and three-letter codes. Fast drilling.' },
  { id: 'classify', icon: 'grid', name: 'Classify',
    desc: 'Sort each residue into its side-chain class.' },
  { id: 'props', icon: 'sliders', name: 'Properties',
    desc: 'Charge, pKa, functional groups, biochemistry trivia.' },
  { id: 'charge', icon: 'flask', name: 'Charge at pH',
    desc: 'Net charge at any pH, worked out group by group against each pKa.' },
  { id: 'isoelectric', icon: 'balance', name: 'pKa & pI',
    desc: 'Which two pKa values set the pI, and which way a residue runs on a gel.' },
  { id: 'gauntlet', icon: 'timer', name: 'Gauntlet',
    desc: `Everything at once, ${GAUNTLET_SECONDS} seconds on the clock.` }
];

/* The sky: 'sky' follows the clock, 'light' and 'dark' pin it. */
const THEMES = [
  { id: 'sky', icon: 'auto', label: 'Sky follows the clock', next: 'Pin to daytime' },
  { id: 'light', icon: 'sun', label: 'Pinned to daytime', next: 'Pin to night' },
  { id: 'dark', icon: 'moon', label: 'Pinned to night', next: 'Let the sky follow the clock' }
];

/* ---------------------------------------------------------- state */

const S = {
  screen: 'home',
  mode: null,
  form: 'neutral',
  theme: 'sky',
  yield: 1,
  off: [],
  filter: 'all',
  q: null,
  answered: false,
  idx: 0,
  score: 0,
  streak: 0,
  best: 0,
  newBest: false,
  missed: [],
  recent: [],
  timer: null,
  timeLeft: 0
};

const STORE_KEY = 'aa-game-v1';
let stats = {};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    stats = d.stats || {};
    S.form = d.form === 'ion' ? 'ion' : 'neutral';
    S.best = d.best || 0;
    if (THEMES.some(t => t.id === d.theme)) S.theme = d.theme;
    if (d.yield === 0 || d.yield === 1 || d.yield === 2) S.yield = d.yield;
    /* Drop anything unrecognised, and never restore a set so small the
       games cannot run — a corrupted key should not brick it. */
    if (Array.isArray(d.off)) {
      const off = d.off.filter(c => ALL_CODES.includes(c));
      S.off = (ALL_CODES.length - off.length >= MIN_ACTIVE) ? off : [];
    }
  } catch (e) { /* storage unavailable: run in memory */ }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      stats, form: S.form, best: S.best, theme: S.theme, yield: S.yield, off: S.off
    }));
  } catch (e) { /* ignore */ }
}

function stat(code) {
  if (!stats[code]) stats[code] = { seen: 0, correct: 0, streak: 0 };
  return stats[code];
}

function record(code, ok) {
  const s = stat(code);
  s.seen++;
  if (ok) { s.correct++; s.streak++; }
  else { s.streak = 0; }
  save();
}

function mastery(code) {
  const s = stats[code];
  if (!s || !s.seen) return 0;
  return Math.min(1, s.streak / 5);
}

/* ------------------------------------------------------- study set

   Clicking a letter on the menu takes that residue out of every game.
   S.off holds the skipped ones. At least MIN_ACTIVE must stay in so the
   generators always have something to work with, and multiple choice
   scales down to however many are left rather than padding the options
   with residues the user deliberately excluded.
   ------------------------------------------------------------------ */
const MIN_ACTIVE = 2;

function isActive(code) { return !S.off.includes(code); }
function activeCodes() { return ALL_CODES.filter(isActive); }

/* Never ask for more wrong answers than the study set can supply. */
function distractorCount(want = 3) {
  return Math.max(1, Math.min(want, activeCodes().length - 1));
}

function toggleCode(code) {
  if (isActive(code)) {
    if (activeCodes().length <= MIN_ACTIVE) return false;
    S.off.push(code);
  } else {
    S.off = S.off.filter(c => c !== code);
  }
  save();
  return true;
}

/* Mastery reflects what you are actually studying, so skipping the ones
   you already know does not leave the number stuck low. */
function overallMastery() {
  const act = activeCodes();
  return act.reduce((t, c) => t + mastery(c), 0) / act.length;
}

/* ------------------------------------------------------- utilities */

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample(arr, n) { return shuffle(arr).slice(0, n); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* Weighted draw: unseen and recently-missed residues come round more
   often, mastered ones fade into the background. */
function pickAA(exclude = []) {
  const act = activeCodes();
  const pool = act.filter(c => !exclude.includes(c) && !S.recent.includes(c));
  const cands = pool.length ? pool : act.filter(c => !exclude.includes(c));
  if (!cands.length) return act[0];

  const weights = cands.map(c => {
    const s = stats[c];
    if (!s || !s.seen) return 3.5;
    const acc = s.correct / s.seen;
    return 0.5 + 3 * (1 - acc) + Math.max(0, 4 - s.streak) * 0.45;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i];
    if (r <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

function noteRecent(code) {
  S.recent.push(code);
  if (S.recent.length > 5) S.recent.shift();
}

/* Distractors: prefer same-class residues, which is where the real
   confusion lives, then top up from everything else in play. */
function distractors(code, n, sameClassBias = 0.65) {
  const a = aa(code);
  const act = activeCodes().filter(c => c !== code);
  const same = act.filter(c => aa(c).cls === a.cls);
  const other = act.filter(c => aa(c).cls !== a.cls);
  const out = [];
  out.push(...sample(same, Math.min(same.length, Math.round(n * sameClassBias))));
  out.push(...sample(other, n - out.length));
  if (out.length < n) out.push(...sample(act.filter(c => !out.includes(c)), n - out.length));
  return out.slice(0, n);
}

/* Category colour hooks: the colour is always beside the name, never alone. */
const catStyle = cls => `style="--cat:var(--sd-cat-${CLASSES[cls].cat})"`;
const badge = code => `<span class="badge" ${catStyle(aa(code).cls)}>${code}</span>`;
const clsLabel = cls => `<span class="dot" ${catStyle(cls)}></span>${esc(CLASSES[cls].label)}`;

function nameTag(code) {
  const a = aa(code);
  return `<b>${esc(a.name)}</b> <span class="dim">${a.three} · ${a.code}</span>`;
}

/* ------------------------------------------------- letter card

   One shared popover, filled on hover, rather than twenty pre-rendered
   ones — the structure alone would be twenty extra SVGs in the DOM.
   ------------------------------------------------------------------ */
function letterCardHTML(code) {
  const a = aa(code);
  const s = stats[code] || { seen: 0, correct: 0 };
  const m = Math.round(mastery(code) * 100);
  const off = !isActive(code);
  return `
    <div class="lc-head">
      ${badge(code)}
      <div>
        <div class="lc-name">${esc(a.name)}</div>
        <div class="lc-cls">${clsLabel(a.cls)}</div>
      </div>
    </div>
    <div class="lc-mol">${moleculeSVG(code, { form: S.form })}</div>
    <div class="lc-bar"><span style="width:${m}%"></span></div>
    <div class="lc-stats">
      <span><b>${m}%</b> mastered</span>
      <span>${s.seen ? s.correct + ' of ' + s.seen + ' right' : 'not seen yet'}</span>
    </div>
    <div class="lc-act${off ? ' lc-act--off' : ''}">${off
      ? 'Skipped — click to put it back'
      : 'Click to leave it out of the games'}</div>`;
}

function showLetterCard(letter) {
  const pop = document.getElementById('letterCard');
  const host = pop && pop.parentElement;
  if (!pop) return;
  pop.innerHTML = letterCardHTML(letter.dataset.chip);
  pop.hidden = false;
  /* under the letter, clamped so it never hangs off the card */
  const hr = host.getBoundingClientRect(), lr = letter.getBoundingClientRect();
  const w = pop.offsetWidth;
  const left = Math.max(12, Math.min(lr.left - hr.left + lr.width / 2 - w / 2, hr.width - w - 12));
  pop.style.left = left + 'px';
  pop.style.top = (lr.bottom - hr.top + 8) + 'px';
}

function hideLetterCard() {
  const pop = document.getElementById('letterCard');
  if (pop) pop.hidden = true;
}

/* A short "why" panel shown after every answer. */
function explainCard(code, extra) {
  const a = aa(code);
  return `
    <div class="explain">
      <div class="ex-head">
        ${badge(code)}
        <div>
          <div class="ex-name">${esc(a.name)} <span class="dim">(${a.three})</span></div>
          <div class="ex-cls">${clsLabel(a.cls)}</div>
        </div>
      </div>
      ${extra ? `<div class="ex-extra">${extra}</div>` : ''}
      <div class="ex-grid">
        <div><span>Side chain</span>${esc(a.group)}</div>
        <div><span>Charge at pH 7</span>${chargeLabel(a)}</div>
        <div><span>Side-chain pKa</span>${a.pKaR ? a.pKaR.toFixed(2) : '—'}</div>
        <div><span>pI</span>${a.pI.toFixed(2)}</div>
      </div>
      <p class="ex-mnem">${esc(a.mnemonic)}</p>
    </div>`;
}

/* -------------------------------------------------- question types

   A structure shown AS a question must not announce its name to a
   screen reader, so quiz drawings carry a neutral label. */
const QUIET = { label: 'Skeletal structure' };

function qStructToName() {
  const code = pickAA();
  const opts = shuffle([code, ...distractors(code, distractorCount())]);
  return {
    kind: 'mc', code, tag: 'Structure',
    prompt: 'Which amino acid is this?',
    svg: moleculeSVG(code, { form: S.form, ...QUIET }),
    choices: opts.map(c => ({ value: c, html: nameTag(c) })),
    answer: opts.indexOf(code),
    explainWith: 'The side chain is the coloured part — that is the only thing that differs between the twenty.'
  };
}

function qNameToStruct() {
  const code = pickAA();
  const a = aa(code);
  const opts = shuffle([code, ...distractors(code, distractorCount())]);
  return {
    kind: 'mc-svg', code, tag: 'Structure',
    prompt: `Pick the structure of <b>${esc(a.name)}</b> <span class="dim">(${a.three})</span>`,
    choices: opts.map((c, i) => ({
      value: c, svg: moleculeSVG(c, { form: S.form, label: `Option ${i + 1}` })
    })),
    answer: opts.indexOf(code),
    explainWith: `Look for: ${esc(a.group.toLowerCase())}.`
  };
}

/* One-letter codes are the must-know; recalling a full name from a
   letter, or a three-letter code from a drawing, is a step past that. */
const CODE_VARIANTS = [
  { y: HI, id: 'name2one' },
  { y: HI, id: 'three2one' },
  { y: MED, id: 'struct2three' },
  { y: MED, id: 'one2name' }
];

function qCodes() {
  const code = pickAA();
  const a = aa(code);
  const variant = pick(atYield(CODE_VARIANTS)).id;

  if (variant === 'name2one') {
    return {
      kind: 'type', code, tag: 'Abbreviation', maxlen: 1,
      prompt: `One-letter code for <b>${esc(a.name)}</b>?`,
      placeholder: '?',
      check: v => v.trim().toUpperCase() === a.code,
      answerText: a.code,
      explainWith: 'Three-letter code: <b>' + a.three + '</b>'
    };
  }
  if (variant === 'three2one') {
    return {
      kind: 'type', code, tag: 'Abbreviation', maxlen: 1,
      prompt: `<b>${a.three}</b> — what is the one-letter code?`,
      placeholder: '?',
      check: v => v.trim().toUpperCase() === a.code,
      answerText: a.code,
      explainWith: esc(a.name)
    };
  }
  if (variant === 'struct2three') {
    return {
      kind: 'type', code, tag: 'Abbreviation', maxlen: 3,
      svg: moleculeSVG(code, { form: S.form, ...QUIET }),
      prompt: 'Three-letter code for this amino acid?',
      placeholder: 'Xxx',
      check: v => v.trim().toLowerCase() === a.three.toLowerCase(),
      answerText: a.three,
      explainWith: 'One-letter code: <b>' + a.code + '</b>'
    };
  }
  return {
    kind: 'type', code, tag: 'Abbreviation', maxlen: 20, wide: true,
    prompt: `Which amino acid is <b>${a.code}</b>?`,
    placeholder: 'Full name',
    check: v => nameMatches(v, a),
    answerText: a.name,
    explainWith: 'Three-letter code: <b>' + a.three + '</b>'
  };
}

function qClassify() {
  const code = pickAA();
  const a = aa(code);
  return {
    kind: 'mc', code, tag: 'Class', columns: 1,
    prompt: `Which class does <b>${esc(a.name)}</b> belong to?`,
    svg: moleculeSVG(code, { form: S.form, ...QUIET }),
    choices: CLASS_ORDER.map(c => ({ value: c, html: clsLabel(c) })),
    answer: CLASS_ORDER.indexOf(a.cls),
    explainWith: esc(CLASSES[a.cls].blurb)
  };
}

/* -- property questions ------------------------------------------- */

const FACTS = [
  { y: HI, q: 'Which amino acid is the only achiral one?', a: 'G' },
  { y: HI, q: 'Which amino acid forms disulfide bridges?', a: 'C' },
  { y: HI, q: 'Which amino acid is encoded by the start codon AUG?', a: 'M' },
  { y: HI, q: 'Which residue kinks α-helices because its side chain locks the backbone?', a: 'P' },
  { y: HI, q: 'Which side chain has a pKa near 6, so it buffers at physiological pH?', a: 'H' },
  { y: HI, q: 'Which side chain is the strongest base?', a: 'R' },
  { y: HI, q: 'Sickle-cell disease swaps which residue at position 6 of β-globin?', a: 'E' },
  { y: MED, q: 'Which amino acid is the only secondary amine (an "imino acid")?', a: 'P' },
  { y: MED, q: 'Which amino acid contributes most to protein absorbance at 280 nm?', a: 'W' },
  { y: MED, q: 'Which amino acid is the precursor of dopamine, adrenaline and melanin?', a: 'Y' },
  { y: MED, q: 'Which amino acid is the main excitatory neurotransmitter in the CNS?', a: 'E' },
  { y: MED, q: 'Which residue is the nucleophile in the serine-protease catalytic triad?', a: 'S' },
  { y: MED, q: 'Which sulfur-containing amino acid cannot form disulfide bonds?', a: 'M' },
  { y: MED, q: 'Which amino acid builds up toxically in phenylketonuria (PKU)?', a: 'F' },
  { y: LOW, q: 'Which is the largest and heaviest amino acid?', a: 'W' }
];

function propCharge() {
  const code = pickAA();
  const a = aa(code);
  const opts = ['−1', '0 (neutral)', '+1'];
  return {
    kind: 'mc', code, tag: 'Charge', columns: 1,
    prompt: `Net charge on the <b>${esc(a.name)}</b> side chain at pH 7.0?`,
    choices: opts.map(o => ({ value: o, html: o })),
    answer: opts.indexOf(chargeLabel(a)),
    explainWith: (a.pKaR
      ? `The side-chain pKa is ${a.pKaR.toFixed(2)}, and pH 7 is ${a.pKaR < 7 ? 'above' : 'below'} that, `
        + `so the group is mostly ${a.pKaR < 7 ? 'deprotonated' : 'protonated'}.`
        + (a.code === 'H'
          ? ' His is the near miss: its pKa of 6.0 is just under pH 7, so the ring is only about'
            + ' 9% protonated there. It is classed as basic for its chemistry, but at pH 7 it is'
            + ' predominantly neutral — which is exactly what makes it a physiological buffer.'
          : '')
      : 'This side chain has no ionisable group, so it stays neutral at every physiological pH.')
  };
}

function propPka() {
  const ion = AAS.filter(x => x.pKaR && isActive(x.code)).map(x => x.code);
  if (ion.length < 2) return propCharge();
  const code = pick(ion);
  const a = aa(code);
  const opts = shuffle([code, ...sample(ion.filter(c => c !== code), distractorCount())]);
  return {
    kind: 'mc', code, tag: 'pKa',
    prompt: `Which side chain has a pKa of about <b>${a.pKaR.toFixed(1)}</b>?`,
    choices: opts.map(c => ({ value: c, html: nameTag(c) })),
    answer: opts.indexOf(code),
    explainWith: 'The seven ionisable side chains, low to high: Asp 3.7 · Glu 4.3 · His 6.0 · Cys 8.2 · Tyr 10.1 · Lys 10.5 · Arg 12.5.'
  };
}

function propGroup() {
  const code = pickAA();
  const a = aa(code);
  const others = shuffle(AAS.filter(x => isActive(x.code) && x.groupKey !== a.groupKey))
    .filter((x, i, arr) => arr.findIndex(y => y.group === x.group) === i)
    .slice(0, distractorCount()).map(x => x.group);
  if (!others.length) return propCharge();
  const opts = shuffle([a.group, ...others]);
  return {
    kind: 'mc', code, tag: 'Functional group', columns: 1,
    prompt: `Which functional group sits in the <b>${esc(a.name)}</b> side chain?`,
    choices: opts.map(o => ({ value: o, html: esc(o) })),
    answer: opts.indexOf(a.group),
    explainWith: esc(a.note)
  };
}

function propClassMember() {
  const act = activeCodes();
  const want = distractorCount();
  /* only a class that still has a member in play AND enough outside it */
  const usable = CLASS_ORDER.filter(cl =>
    act.some(c => aa(c).cls === cl) && act.filter(c => aa(c).cls !== cl).length >= want);
  if (!usable.length) return propCharge();

  const cls = pick(usable);
  const code = pick(act.filter(c => aa(c).cls === cls));
  const opts = shuffle([code, ...sample(act.filter(c => aa(c).cls !== cls), want)]);
  return {
    kind: 'mc', code, tag: 'Class',
    prompt: `Which of these is <b>${esc(CLASSES[cls].label.toLowerCase())}</b>?`,
    choices: opts.map(c => ({ value: c, html: nameTag(c) })),
    answer: opts.indexOf(code),
    explainWith: esc(CLASSES[cls].blurb)
  };
}

/* Some residues share a value (Gly and Val are both pI 5.97). Pick the
   winner first, then draw the rest from strictly the other side, so a
   "highest / lowest" question can only have one right answer. */
function fourWithUniqueExtreme(key, wantMax) {
  const act = activeCodes();
  const want = distractorCount();
  for (const w of shuffle(act)) {
    const wv = aa(w)[key];
    const rest = act.filter(c => c !== w && (wantMax ? aa(c)[key] < wv : aa(c)[key] > wv));
    if (rest.length >= want) return shuffle([w, ...sample(rest, want)]);
  }
  return null;
}

function propFact() {
  const pool = atYield(FACTS).filter(f => isActive(f.a));
  if (!pool.length) return propCharge();
  const f = pick(pool);
  const opts = shuffle([f.a, ...distractors(f.a, distractorCount(), 0.4)]);
  return {
    kind: 'mc', code: f.a, tag: 'Biochemistry',
    prompt: f.q,
    choices: opts.map(c => ({ value: c, html: nameTag(c) })),
    answer: opts.indexOf(f.a),
    explainWith: esc(aa(f.a).note)
  };
}

/* propFact twice so trivia keeps roughly a third of the mode. */
const PROP_QS = [
  { y: HI, gen: propCharge },
  { y: HI, gen: propPka },
  { y: HI, gen: propClassMember },
  { y: HI, gen: propFact },
  { y: HI, gen: propFact },
  { y: MED, gen: propGroup }
];

function qProps() { return pick(atYield(PROP_QS)).gen(); }

/* -- ionisation: charge at a given pH, and pI --------------------- */

const chgClass = q => q > 0 ? 'chg-pos' : q < 0 ? 'chg-neg' : 'chg-zero';

/* Kept clear of every pKa by `gap` so the answer is a clean call and
   not a coin flip on a residue that is half-titrated at that pH. */
const PH_CHOICES = [1, 2, 3, 4, 5, 6, 7, 7.4, 8, 9, 10, 11, 12, 13];

function pickPH(code, pool = PH_CHOICES, gap = 0.7) {
  const ladder = pKaLadder(code);
  const safe = pool.filter(p => ladder.every(g => Math.abs(p - g.pKa) >= gap));
  return pick(safe.length ? safe : pool);
}

/* Group-by-group working, shown after the answer. */
function ionTable(code, pH) {
  const rows = pKaLadder(code).map(g => {
    const above = pH > g.pKa;
    const q = above ? g.to : g.from;
    return `<tr>
      <td>${g.group}</td>
      <td class="n">${g.pKa.toFixed(2)}</td>
      <td>pH is ${above ? 'above' : 'below'} it, so ${above ? 'deprotonated' : 'protonated'}</td>
      <td class="q ${chgClass(q)}">${chargeStr(q)}</td></tr>`;
  }).join('');
  const net = netChargeAt(code, pH);
  return `<div class="tw"><table class="ion-table">
    <thead><tr><th>Group</th><th class="n">pKa</th><th>At pH ${pH}</th><th class="q">Charge</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="3">Net charge</td><td class="q ${chgClass(net)}">${chargeStr(net)}</td></tr></tfoot>
  </table></div>`;
}

/* Titration ladder: net charge stepping down as each group lets go. */
function piLadder(code) {
  const L = pKaLadder(code);
  const { pI } = computePI(code);
  let charge = L.reduce((s, g) => s + g.from, 0);
  const parts = [`<span class="lad-q ${chgClass(charge)}">${chargeStr(charge)}</span>`];
  L.forEach(g => {
    parts.push(`<span class="lad-p">${g.pKa.toFixed(2)}</span>`);
    charge += g.to - g.from;
    parts.push(`<span class="lad-q ${chgClass(charge)}">${chargeStr(charge)}</span>`);
  });
  return `<div class="tw"><div class="ladder">${parts.join('')}</div></div>
    <p class="lad-note">Net charge as the pH rises. The pI is the midpoint of the two
    pKa values flanking the <b>0</b>, here <b>pI ${pI.toFixed(2)}</b>.</p>`;
}

function qChargeAtPH() {
  const code = pickAA();
  const a = aa(code);
  /* at high yield, stay at physiological pH — the version the exam asks */
  const pH = pickPH(code, yieldCap() === HI ? [7, 7.4] : PH_CHOICES);
  const opts = [-2, -1, 0, 1, 2];
  return {
    kind: 'mc', code, tag: 'Charge at pH', columns: 1,
    prompt: `What is the <b>net charge</b> on <b>${esc(a.name)}</b> at <b>pH ${pH}</b>?`,
    choices: opts.map(o => ({ value: o, html: chargeStr(o) })),
    answer: opts.indexOf(netChargeAt(code, pH)),
    explainWith: 'Take each ionisable group in turn: above its pKa it has given up its proton.'
      + ionTable(code, pH)
  };
}

const IONISABLE = AAS.filter(x => x.pKaR).map(x => x.code);

function piPair() {
  const ion = IONISABLE.filter(isActive);
  if (!ion.length) return qChargeAtPH();
  const code = pick(ion);
  const a = aa(code);
  const L = pKaLadder(code);
  const { pair } = computePI(code);

  const combos = [];
  for (let i = 0; i < L.length; i++)
    for (let j = i + 1; j < L.length; j++) combos.push([L[i], L[j]]);

  const label = p => `${p[0].pKa.toFixed(2)} and ${p[1].pKa.toFixed(2)} ` +
    `<span class="dim">(${p[0].group} + ${p[1].group})</span>`;
  const all = shuffle(combos.map(p => ({ key: p[0].pKa + '/' + p[1].pKa, html: label(p) })));
  all.splice(Math.floor(Math.random() * (all.length + 1)), 0,
    { key: 'all3', html: `The average of all three <span class="dim">(${L.map(g => g.pKa.toFixed(2)).join(', ')})</span>` });

  const want = pair[0].pKa + '/' + pair[1].pKa;
  return {
    kind: 'mc', code, tag: 'pI', columns: 1,
    prompt: `To get the pI of <b>${esc(a.name)}</b>, which two pKa values do you average?`,
    choices: all.map(o => ({ value: o.key, html: o.html })),
    answer: all.findIndex(o => o.key === want),
    explainWith: 'Never all three, and not always the side chain: you want the two that '
      + 'bracket the species with no net charge.' + piLadder(code)
  };
}

function piEstimate() {
  const code = pickAA();
  const a = aa(code);
  /* distractors must differ from the answer AND from each other */
  const want = distractorCount();
  const others = [];
  for (const x of shuffle(AAS.filter(x => isActive(x.code)))) {
    if (Math.abs(x.pI - a.pI) <= 0.7) continue;
    if (others.some(p => Math.abs(p - x.pI) < 0.05)) continue;
    others.push(x.pI);
    if (others.length === want) break;
  }
  if (!others.length) return qChargeAtPH();
  const opts = shuffle([a.pI, ...others]);
  return {
    kind: 'mc', code, tag: 'pI',
    prompt: `Which is closest to the pI of <b>${esc(a.name)}</b>?`,
    choices: opts.map(o => ({ value: o, html: o.toFixed(2) })),
    answer: opts.indexOf(a.pI),
    explainWith: `${esc(a.name)} is ${a.pKaR ? 'ionisable in the side chain' : 'neutral in the side chain, so only the backbone matters'}.`
      + piLadder(code)
  };
}

function piRank() {
  const highest = Math.random() < 0.5;
  const four = fourWithUniqueExtreme('pI', highest);
  if (!four) return piPair();
  const sorted = four.slice().sort((x, y) => aa(y).pI - aa(x).pI);
  const code = highest ? sorted[0] : sorted[sorted.length - 1];
  return {
    kind: 'mc', code, tag: 'pI',
    prompt: `Which of these has the <b>${highest ? 'highest' : 'lowest'} pI</b>?`,
    choices: four.map(c => ({ value: c, html: nameTag(c) })),
    answer: four.indexOf(code),
    explainWith: 'A basic side chain drags the pI up, an acidic one drags it down: '
      + sorted.map(c => `${aa(c).three} ${aa(c).pI.toFixed(2)}`).join(' · ')
  };
}

function piElectrophoresis() {
  const code = pickAA();
  const a = aa(code);
  /* far from the pI so the direction is unambiguous, and clear of every
     pKa so the breakdown underneath is honest */
  const ladder = pKaLadder(code);
  const cands = PH_CHOICES.filter(p => Math.abs(p - a.pI) >= 0.8 &&
    ladder.every(g => Math.abs(p - g.pKa) >= 0.5));
  const pH = pick(cands.length ? cands : PH_CHOICES.filter(p => Math.abs(p - a.pI) >= 0.8));
  const positive = pH < a.pI;
  const opts = [
    { v: 'cathode', html: 'Toward the <b>cathode</b> <span class="dim">(negative electrode)</span>' },
    { v: 'anode', html: 'Toward the <b>anode</b> <span class="dim">(positive electrode)</span>' },
    { v: 'stay', html: 'It stays at the origin' }
  ];
  return {
    kind: 'mc', code, tag: 'Electrophoresis', columns: 1,
    prompt: `At <b>pH ${pH}</b>, which way does <b>${esc(a.name)}</b> migrate in an electric field?`,
    choices: opts.map(o => ({ value: o.v, html: o.html })),
    answer: positive ? 0 : 1,
    explainWith: `Its pI is <b>${a.pI.toFixed(2)}</b>. The buffer at pH ${pH} is `
      + `${positive ? 'more acidic than' : 'more basic than'} the pI, so the residue keeps a net `
      + `<b>${positive ? 'positive' : 'negative'}</b> charge and is pulled to the `
      + `<b>${positive ? 'cathode' : 'anode'}</b>. Opposites attract; at pH = pI it would not move at all.`
      + ionTable(code, pH)
  };
}

/* piPair is the actual pI skill, so it survives at every level. */
const PI_QS = [
  { y: HI, gen: piPair },
  { y: MED, gen: piEstimate },
  { y: MED, gen: piElectrophoresis },
  { y: LOW, gen: piRank }
];

function qIsoelectric() { return pick(atYield(PI_QS)).gen(); }

const GENERATORS = {
  struct2name: qStructToName,
  name2struct: qNameToStruct,
  codes: qCodes,
  classify: qClassify,
  props: qProps,
  charge: qChargeAtPH,
  isoelectric: qIsoelectric
};

/* The only place the yield setting applies: the flag is on for just
   this draw, so the sub-generators narrow themselves. */
GENERATORS.gauntlet = () => {
  yieldActive = true;
  try {
    return pick(MODES.filter(m => m.id !== 'gauntlet').map(m => GENERATORS[m.id]))();
  } finally {
    yieldActive = false;
  }
};

/* ------------------------------------------------------------ views */

const app = () => document.getElementById('app');

function render() {
  /* the donation footer belongs on the menu only, not over a quiz */
  const foot = document.querySelector('.sitefoot');
  if (foot) foot.hidden = S.screen !== 'home';
  hideLetterCard();

  if (S.screen === 'home') renderHome();
  else if (S.screen === 'quiz') renderQuiz();
  else if (S.screen === 'results') renderResults();
  else if (S.screen === 'study') renderStudy();
  app().classList.remove('view');
  void app().offsetWidth;   // restart the cross-fade
  app().classList.add('view');
}

function renderHome() {
  const act = activeCodes();
  const pct = Math.round(overallMastery() * 100);
  const seen = act.filter(c => stats[c] && stats[c].seen).length;
  const level = YIELD_LEVELS[S.yield];

  app().innerHTML = `
    <section class="hero">
      <h1>Twenty amino acids, committed to memory</h1>
    </section>

    <div class="home">
      <section class="card" aria-labelledby="progressTitle">
        <p class="lede" id="progressTitle">Structures are drawn from real bond geometry. The
        <b>side chain</b> is highlighted against the shared backbone, because that is the
        only part that changes.</p>
        <div class="progress__row">
          <div class="stat"><b>${pct}%</b><span>mastered</span></div>
          <div class="letters" role="group" aria-label="Residues in play">
            ${ALL_CODES.map(c => {
              const a = aa(c);
              const off = !isActive(c);
              return `<button class="letter${off ? ' letter--off' : ''}" data-chip="${c}"
                        style="--cat:var(--sd-cat-${CLASSES[a.cls].cat});--m:${mastery(c)}"
                        aria-pressed="${off ? 'false' : 'true'}"
                        aria-label="${esc(a.name)}, ${off ? 'skipped' : 'in play'}">${c}</button>`;
            }).join('')}
          </div>
          <div class="stat"><b>${seen}/${act.length}</b><span>encountered</span></div>
        </div>
        <div class="progress__foot">
          <span>${S.off.length
            ? `<b>${S.off.length}</b> skipped — <button class="btn btn--text" id="allOn">Study all 20</button>`
            : 'Click a letter to leave it out of the games'}</span>
          <button class="btn btn--text" id="reset">Reset progress</button>
        </div>
        <div class="popover lettercard" id="letterCard" role="tooltip" hidden></div>
      </section>

      <section class="modes" aria-label="Modes">
        ${MODES.map(m => m.id === 'gauntlet' ? `
          <div class="card mode mode--gauntlet">
            <button class="mode__go" data-mode="gauntlet">
              <span class="mode__icon">${icon(m.icon)}</span>
              <span class="mode__name">${m.name}</span>
              <span class="mode__desc">${m.desc}</span>
            </button>
            <div class="mode__yield">
              <span class="mode__yield-label" id="yieldLabel">MCAT yield for the Gauntlet</span>
              <div class="seg seg--full" role="radiogroup" aria-labelledby="yieldLabel">
                ${YIELD_LEVELS.map((l, i) => `
                  <button class="seg__opt" role="radio" data-y="${i}"
                          aria-checked="${i === S.yield}">${esc(l.name)}</button>`).join('')}
              </div>
              <p class="hint" id="yieldHint">${esc(level.blurb)}</p>
            </div>
          </div>` : `
          <button class="card mode" data-mode="${m.id}">
            <span class="mode__icon">${icon(m.icon)}</span>
            <span class="mode__name">${m.name}</span>
            <span class="mode__desc">${m.desc}</span>
          </button>`).join('')}
        <button class="card mode mode--study" data-mode="study">
          <span class="mode__icon">${icon('book')}</span>
          <span class="mode__name">Reference table</span>
          <span class="mode__desc">All twenty side by side, with every property. Study first, then drill.</span>
        </button>
      </section>

      ${S.best ? `<p class="footnote">Best Gauntlet score: ${S.best}</p>` : ''}
    </div>`;

  app().querySelectorAll('[data-mode]').forEach(b => {
    b.onclick = () => {
      const m = b.dataset.mode;
      if (m === 'study') { S.screen = 'study'; render(); }
      else startRound(m);
    };
  });

  /* yield: a radio group; arrow keys move the selection */
  const seg = app().querySelector('.mode__yield .seg');
  const setYield = (i, focus) => {
    S.yield = i;
    save();
    seg.querySelectorAll('.seg__opt').forEach((b, j) => {
      b.setAttribute('aria-checked', String(j === i));
      if (focus && j === i) b.focus();
    });
    document.getElementById('yieldHint').textContent = YIELD_LEVELS[i].blurb;
  };
  seg.querySelectorAll('.seg__opt').forEach(b => {
    b.onclick = () => setYield(+b.dataset.y, false);
    b.onkeydown = e => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
              : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (d) { e.preventDefault(); setYield((S.yield + d + 3) % 3, true); }
    };
  });

  /* letters: hover for the card, click to drop the residue from the games */
  app().querySelectorAll('[data-chip]').forEach(letter => {
    letter.onmouseenter = () => showLetterCard(letter);
    letter.onfocus = () => showLetterCard(letter);
    letter.onmouseleave = hideLetterCard;
    letter.onblur = hideLetterCard;
    letter.onclick = () => {
      if (!toggleCode(letter.dataset.chip)) {
        /* at the floor — say so rather than silently ignoring the click */
        const act = document.querySelector('#letterCard .lc-act');
        if (act) { act.textContent = `Keep at least ${MIN_ACTIVE} in play`; act.className = 'lc-act lc-act--warn'; }
        return;
      }
      render();
      const again = app().querySelector(`[data-chip="${letter.dataset.chip}"]`);
      if (again) showLetterCard(again);
    };
  });

  const allOn = document.getElementById('allOn');
  if (allOn) allOn.onclick = () => { S.off = []; save(); render(); };

  document.getElementById('reset').onclick = () => confirmDialog({
    title: 'Reset progress?',
    body: 'Every residue goes back to unseen and the best Gauntlet score is cleared. The letters you have skipped stay skipped.',
    confirm: 'Reset',
    onConfirm: () => { stats = {}; S.best = 0; save(); render(); }
  });
}

/* A Sky Diary dialog in place of the browser's confirm(). */
function confirmDialog({ title, body, confirm, onConfirm }) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlgTitle" tabindex="-1">
      <div class="dialog__head"><h2 class="dialog__title" id="dlgTitle">${esc(title)}</h2></div>
      <div class="dialog__body">${esc(body)}</div>
      <div class="dialog__foot">
        <button class="btn btn--ghost" data-act="cancel">Cancel</button>
        <button class="btn btn--danger" data-act="ok">${esc(confirm)}</button>
      </div>
    </div>`;
  const previous = document.activeElement;
  const close = () => {
    scrim.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
    if (previous && previous.focus) previous.focus();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  scrim.querySelector('[data-act="cancel"]').onclick = close;
  scrim.querySelector('[data-act="ok"]').onclick = () => { close(); onConfirm(); };
  scrim.onclick = e => { if (e.target === scrim) close(); };
  document.addEventListener('keydown', onKey);
  document.body.classList.add('modal-open');
  document.body.appendChild(scrim);
  scrim.querySelector('[data-act="cancel"]').focus();
}

function startRound(mode) {
  S.mode = mode;
  S.screen = 'quiz';
  S.idx = 0;
  S.score = 0;
  S.streak = 0;
  S.newBest = false;
  S.missed = [];
  S.recent = [];
  if (mode === 'gauntlet') {
    S.timeLeft = GAUNTLET_SECONDS;
    clearInterval(S.timer);
    S.timer = setInterval(tick, 1000);
  }
  nextQuestion();
}

function tick() {
  S.timeLeft--;
  const el = document.getElementById('clock');
  if (el) el.textContent = S.timeLeft + 's';
  if (S.timeLeft <= 0) {
    clearInterval(S.timer);
    S.timer = null;
    if (S.score > S.best) { S.best = S.score; S.newBest = true; save(); }
    S.screen = 'results';
    render();
  }
}

function nextQuestion() {
  S.q = GENERATORS[S.mode]();
  noteRecent(S.q.code);
  S.answered = false;
  render();
}

function renderQuiz() {
  const q = S.q;
  const timed = S.mode === 'gauntlet';

  app().innerHTML = `
    <div class="quizbar">
      <button class="btn btn--secondary" id="quit">${icon('back')} Menu</button>
      <div class="quizbar__mid">
        <span class="chip">${esc(q.tag)}</span>
        <span class="counter">${timed ? `Q${S.idx + 1}` : `${S.idx + 1} of ${ROUND_LEN}`}</span>
      </div>
      <div class="quizbar__right">
        ${timed ? `<span class="clock" id="clock">${S.timeLeft}s</span>` : ''}
        <span class="score" aria-label="Score">${S.score}</span>
        ${S.streak > 1 ? `<span class="streak">${S.streak} in a row</span>` : ''}
      </div>
    </div>

    <section class="card">
      <p class="prompt">${q.prompt}</p>
      ${q.svg ? `<div class="stage">${q.svg}</div>` : ''}
      <div id="answers"></div>
      <div id="feedback"></div>
    </section>`;

  document.getElementById('quit').onclick = () => {
    clearInterval(S.timer); S.timer = null;
    S.screen = 'home'; render();
  };

  const box = document.getElementById('answers');

  if (q.kind === 'type') {
    box.innerHTML = `
      <form class="typebox" id="tf" autocomplete="off">
        <label class="sr-only" for="tin">Your answer</label>
        <input id="tin" class="input${q.wide ? '' : ' input--code'}"
               maxlength="${q.maxlen}" placeholder="${esc(q.placeholder)}"
               spellcheck="false" autocapitalize="off" />
        <button type="submit" class="btn btn--primary">Check</button>
      </form>`;
    const input = document.getElementById('tin');
    input.focus();
    document.getElementById('tf').onsubmit = e => {
      e.preventDefault();
      if (S.answered) { advance(); return; }
      submitTyped(input.value);
    };
    if (q.maxlen === 1) {
      input.oninput = () => { if (input.value.length === 1) submitTyped(input.value); };
    }
  } else if (q.kind === 'mc-svg') {
    box.innerHTML = `<div class="opts opts--svg">` + q.choices.map((c, i) =>
      `<button class="opt opt--svg" data-i="${i}"><kbd>${i + 1}</kbd>${c.svg}</button>`
    ).join('') + `</div>`;
  } else {
    box.innerHTML = `<div class="opts${q.columns === 1 ? ' opts--one' : ''}">` +
      q.choices.map((c, i) =>
        `<button class="opt" data-i="${i}"><kbd>${i + 1}</kbd><span class="opt__body">${c.html}</span></button>`
      ).join('') + `</div>`;
  }
  box.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => choose(+b.dataset.i));
}

function submitTyped(value) {
  const q = S.q;
  const ok = q.check(value);
  S.answered = true;
  record(q.code, ok);
  finishAnswer(ok, ok ? '' : `You wrote “${esc(value || '—')}”. The answer is <b>${esc(q.answerText)}</b>.`);
  const input = document.getElementById('tin');
  if (input) {
    input.classList.add(ok ? 'input--good' : 'input--bad');
    input.disabled = true;
  }
}

function choose(i) {
  if (S.answered) return;
  S.answered = true;
  const q = S.q;
  const ok = i === q.answer;
  record(q.code, ok);

  document.querySelectorAll('#answers button[data-i]').forEach((b, j) => {
    b.disabled = true;
    if (j === q.answer) b.classList.add('opt--good');
    else if (j === i) b.classList.add('opt--bad');
  });
  finishAnswer(ok, '');
}

function finishAnswer(ok, extraMsg) {
  if (ok) { S.score++; S.streak++; }
  else { S.streak = 0; S.missed.push(S.q.code); }

  const last = S.mode !== 'gauntlet' && S.idx + 1 >= ROUND_LEN;
  const fb = document.getElementById('feedback');
  fb.innerHTML = `
    <div class="verdict ${ok ? 'verdict--ok' : 'verdict--no'}" role="status">
      <span>${ok ? 'Correct' : 'Not quite'}</span>
      ${extraMsg ? `<em>${extraMsg}</em>` : ''}
    </div>
    ${explainCard(S.q.code, S.q.explainWith)}
    <button class="btn btn--primary btn--full" id="next">${last ? 'See results' : 'Next'} <kbd>↵</kbd></button>`;
  document.getElementById('next').onclick = advance;
  document.getElementById('next').focus();
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function advance() {
  S.idx++;
  if (S.mode !== 'gauntlet' && S.idx >= ROUND_LEN) {
    S.screen = 'results';
    render();
    return;
  }
  nextQuestion();
}

function renderResults() {
  const asked = S.mode === 'gauntlet' ? S.idx : ROUND_LEN;
  const pct = asked ? Math.round(S.score / asked * 100) : 0;
  const missedUnique = [...new Set(S.missed)];
  const modeName = (MODES.find(m => m.id === S.mode) || {}).name || '';

  app().innerHTML = `
    <section class="card results">
      <p class="results__mode">${esc(modeName)}</p>
      <div class="bigscore">${S.score}<span>/ ${asked}</span></div>
      <p class="results__pct">${pct}% correct</p>
      ${S.newBest ? `<p class="results__best">New best.</p>` : ''}

      ${missedUnique.length ? `
        <h3>Worth another look</h3>
        <div class="missed">
          ${missedUnique.map(c => `
            <div class="missed__row">
              <div class="missed__mol">${moleculeSVG(c, { form: S.form })}</div>
              <div class="missed__body">
                <b>${esc(aa(c).name)}</b>
                <span class="dim">${aa(c).three} · ${aa(c).code}</span>
                <span class="missed__note">${esc(aa(c).mnemonic)}</span>
              </div>
            </div>`).join('')}
        </div>` : `<p class="results__clean">Clean sweep — nothing missed.</p>`}

      <div class="results__actions">
        <button class="btn btn--primary" id="again">Go again</button>
        <button class="btn btn--secondary" id="home">Menu</button>
      </div>
    </section>`;

  document.getElementById('again').onclick = () => startRound(S.mode);
  document.getElementById('home').onclick = () => { S.screen = 'home'; render(); };
}

/* ------------------------------------------------------------ study */

function renderStudy() {
  const list = S.filter === 'all' ? AAS : AAS.filter(a => a.cls === S.filter);

  app().innerHTML = `
    <div class="quizbar">
      <button class="btn btn--secondary" id="quit">${icon('back')} Menu</button>
      <div class="quizbar__mid"><span class="chip">Reference</span></div>
      <div class="seg" role="radiogroup" aria-label="Which form to draw">
        <button class="seg__opt" role="radio" data-form="neutral" aria-checked="${S.form === 'neutral'}">Neutral</button>
        <button class="seg__opt" role="radio" data-form="ion" aria-checked="${S.form === 'ion'}">At pH 7</button>
      </div>
    </div>

    <div class="filters" role="group" aria-label="Filter by class">
      <button class="filter" data-f="all" aria-pressed="${S.filter === 'all'}">All 20</button>
      ${CLASS_ORDER.map(c => `
        <button class="filter" data-f="${c}" aria-pressed="${S.filter === c}">
          <span class="dot" ${catStyle(c)}></span>${esc(CLASSES[c].short)}
        </button>`).join('')}
    </div>

    <div class="study">
      ${list.map(a => {
        const m = mastery(a.code);
        return `
        <article class="card ref">
          <header class="ref__head">
            ${badge(a.code)}
            <div class="ref__title">
              <h3>${esc(a.name)}</h3>
              <span class="dim">${a.three}${a.alt.length ? ' · ' + esc(a.alt[0]) : ''}</span>
            </div>
            <span class="ref__mastery" role="img" aria-label="${Math.round(m * 100)}% mastered" title="${Math.round(m * 100)}% mastered"><span style="width:${m * 100}%"></span></span>
          </header>
          <div class="ref__mol">${moleculeSVG(a.code, { form: S.form })}</div>
          <div class="ref__cls">${clsLabel(a.cls)}</div>
          <dl class="ref__props">
            <div><dt>Side chain</dt><dd>${esc(a.group)}</dd></div>
            <div><dt>Charge (pH 7)</dt><dd>${chargeLabel(a)}</dd></div>
            <div><dt>Side-chain pKa</dt><dd>${a.pKaR ? a.pKaR.toFixed(2) : '—'}</dd></div>
            <div><dt>pI</dt><dd>${a.pI.toFixed(2)}</dd></div>
            <div><dt>M<sub>r</sub></dt><dd>${a.mw.toFixed(2)}</dd></div>
            <div><dt>Hydropathy</dt><dd>${a.hydropathy > 0 ? '+' : ''}${a.hydropathy}</dd></div>
            <div><dt>Diet</dt><dd>${essentialLabel(a)}</dd></div>
            <div><dt>Codons</dt><dd class="codons">${a.codons.join(' ')}</dd></div>
          </dl>
          <p class="ref__mnem">${esc(a.mnemonic)}</p>
          <p class="ref__note">${esc(a.note)}</p>
        </article>`;
      }).join('')}
    </div>`;

  document.getElementById('quit').onclick = () => { S.screen = 'home'; render(); };
  app().querySelectorAll('[data-form]').forEach(b =>
    b.onclick = () => { S.form = b.dataset.form; save(); render(); });
  app().querySelectorAll('[data-f]').forEach(b =>
    b.onclick = () => { S.filter = b.dataset.f; render(); });
}

/* ------------------------------------------------------- theme pin */

function renderThemePin() {
  const btn = document.getElementById('themePin');
  if (!btn) return;
  const t = THEMES.find(x => x.id === S.theme) || THEMES[0];
  btn.innerHTML = icon(t.icon);
  btn.setAttribute('aria-label', `${t.label}. ${t.next}`);
  btn.dataset.tip = t.label;
}

function cycleTheme() {
  const i = THEMES.findIndex(t => t.id === S.theme);
  S.theme = THEMES[(i + 1) % THEMES.length].id;
  save();
  refreshSky();
  renderThemePin();
}

/* -------------------------------------------------------- keyboard */

document.addEventListener('keydown', e => {
  if (S.screen !== 'quiz' || document.body.classList.contains('modal-open')) return;
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';

  if (e.key === 'Enter' && S.answered) {
    e.preventDefault();
    advance();
    return;
  }
  if (typing || S.answered) return;

  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9) {
    const btns = document.querySelectorAll('#answers button[data-i]');
    if (btns[n - 1]) { e.preventDefault(); btns[n - 1].click(); }
  }
});

/* ------------------------------------------------------------- boot */

function boot() {
  load();
  buildStars(document.getElementById('stars'), window.innerWidth < 900 ? 16 : 28);
  startSky(() => S.theme);
  renderThemePin();
  document.getElementById('themePin').onclick = cycleTheme;
  render();
}

boot();
