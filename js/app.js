/* ------------------------------------------------------------------
   app.js — screens, question generation, scoring and progress.
   ------------------------------------------------------------------ */

const ROUND_LEN = 12;
const GAUNTLET_SECONDS = 90;

/* ------------------------------------------------------------ yield

   Every mode and every question variant carries a tier. These are
   judgement calls about how often the topic actually turns up, not an
   official AAMC ranking — the slider on the menu sets the ceiling.

   HI  core content that appears on nearly every exam
   MED genuinely tested, but more specific
   LOW true and worth knowing, rarely examined

   The reference table ignores this entirely and always shows all of it.
   ------------------------------------------------------------------ */
const HI = 1, MED = 2, LOW = 3;

/* Every mode is always available and always covers its full content.
   The yield slider narrows the Gauntlet only — see GENERATORS.gauntlet. */
const MODES = [
  { id: 'struct2name', glyph: '⬡', name: 'Structure → Name',
    desc: 'See a skeletal structure, name the amino acid.' },
  { id: 'name2struct', glyph: '◈', name: 'Name → Structure',
    desc: 'Given the name, pick the right side chain out of four.' },
  { id: 'codes', glyph: 'Aa', name: 'Abbreviations',
    desc: 'Type the one- and three-letter codes. Fast drilling.' },
  { id: 'classify', glyph: '▤', name: 'Classify',
    desc: 'Sort each residue into its side-chain class.' },
  { id: 'props', glyph: '±', name: 'Properties',
    desc: 'Charge, pKa, functional groups, biochemistry trivia.' },
  { id: 'charge', glyph: 'pH', name: 'Charge at pH',
    desc: 'Net charge at any pH, worked out group by group against each pKa.' },
  { id: 'isoelectric', glyph: 'pI', name: 'pKa & pI',
    desc: 'Which two pKa values set the pI, and which way a residue runs on a gel.' },
  { id: 'gauntlet', glyph: '⏱', name: 'Gauntlet',
    desc: `Everything at once, ${GAUNTLET_SECONDS} seconds on the clock.` }
];

/* These describe the Gauntlet only. The other modes always run at full
   coverage no matter where the slider sits. */
const YIELD_LEVELS = [
  { name: 'High yield',
    blurb: 'Only what turns up on nearly every exam: structures, one-letter codes, side-chain classes, charge at physiological pH, and the rule for finding a pI.' },
  { name: 'Exam scope',
    blurb: 'Everything the AAMC actually tests: adds three-letter codes, functional groups, pI estimation and gel migration.' },
  { name: 'Everything',
    blurb: 'Adds the rarely-examined long tail. The other modes always cover everything, whatever this is set to.' }
];

/* The slider governs the Gauntlet and nothing else. Outside it this flag
   is false, the ceiling opens to LOW, and every standalone mode serves
   its full range of questions regardless of where the slider sits. */
let yieldActive = false;

/* slider index 0,1,2 -> tier ceiling 1,2,3 */
function yieldCap() { return yieldActive ? S.yield + 1 : LOW; }

/* Keep only items at or below the ceiling, never returning nothing. */
function atYield(items) {
  const cap = yieldCap();
  const ok = items.filter(i => i.y <= cap);
  return ok.length ? ok : items;
}

/* ---------------------------------------------------------- state */

const S = {
  screen: 'home',
  mode: null,
  form: 'neutral',
  yield: 1,
  off: [],
  q: null,
  answered: false,
  idx: 0,
  score: 0,
  streak: 0,
  best: 0,
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
    if (raw) {
      const d = JSON.parse(raw);
      stats = d.stats || {};
      S.form = d.form || 'neutral';
      S.best = d.best || 0;
      if (d.yield === 0 || d.yield === 1 || d.yield === 2) S.yield = d.yield;
      /* Drop anything unrecognised, and never restore a set so small
         the games cannot run — a corrupted key should not brick it. */
      if (Array.isArray(d.off)) {
        const off = d.off.filter(c => ALL_CODES.includes(c));
        S.off = (ALL_CODES.length - off.length >= MIN_ACTIVE) ? off : [];
      }
    }
  } catch (e) { /* file:// with storage disabled — run in memory */ }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY,
      JSON.stringify({ stats, form: S.form, best: S.best,
                       yield: S.yield, off: S.off }));
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

   Clicking a chip on the menu takes that residue out of every game.
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
    if (activeCodes().length <= MIN_ACTIVE) return false;   // keep enough to play
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
  const pool = act.filter(c =>
    !exclude.includes(c) && !S.recent.includes(c));
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
   confusion lives, then top up from everything else. */
function distractors(code, n, sameClassBias = 0.65) {
  const a = aa(code);
  const act = activeCodes().filter(c => c !== code);
  const same = act.filter(c => aa(c).cls === a.cls);
  const other = act.filter(c => aa(c).cls !== a.cls);
  const out = [];
  const wantSame = Math.min(same.length, Math.round(n * sameClassBias));
  out.push(...sample(same, wantSame));
  out.push(...sample(other, n - out.length));
  /* Top up from whatever is left. With a small study set one bucket is
     often empty, and rounding the bias down can otherwise leave none:
     n=1 at a 0.4 bias asks for 0 same-class and 1 other-class, which
     yields nothing at all when every residue in play shares a class. */
  if (out.length < n) {
    out.push(...sample(act.filter(c => !out.includes(c)), n - out.length));
  }
  return out.slice(0, n);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function nameTag(code) {
  const a = aa(code);
  return `<b>${esc(a.name)}</b> <span class="dim">${a.three} · ${a.code}</span>`;
}

/* ------------------------------------------------- mastery chip card

   One shared popup, filled on hover, rather than twenty pre-rendered
   ones — the structure alone would be twenty extra SVGs in the DOM.
   ------------------------------------------------------------------ */
function chipPopHTML(code) {
  const a = aa(code), cl = CLASSES[a.cls];
  const s = stats[code] || { seen: 0, correct: 0 };
  const m = Math.round(mastery(code) * 100);
  const off = !isActive(code);
  return `
    <div class="cp-head" style="--hue:${cl.hue}">
      <span class="pill">${a.code}</span>
      <div class="cp-id">
        <div class="cp-name">${esc(a.name)}</div>
        <div class="cp-cls">${a.three} · ${esc(cl.label)}</div>
      </div>
    </div>
    <div class="cp-mol">${moleculeSVG(code, { form: S.form, plain: true })}</div>
    <div class="cp-bar"><span style="width:${m}%"></span></div>
    <div class="cp-stats">
      <span><b>${m}%</b> mastered</span>
      <span>${s.seen ? s.correct + ' of ' + s.seen + ' right' : 'not seen yet'}</span>
    </div>
    <div class="cp-act${off ? ' is-off' : ''}">${off
      ? 'Skipped — click to put it back'
      : 'Click to leave it out of the games'}</div>`;
}

function showChipPop(chip) {
  const pop = document.getElementById('chipPop');
  const band = document.querySelector('.progress-band');
  if (!pop || !band) return;
  pop.innerHTML = chipPopHTML(chip.dataset.chip);
  pop.hidden = false;

  /* Position under the chip, clamped so it never hangs off the card. */
  const br = band.getBoundingClientRect(), cr = chip.getBoundingClientRect();
  const w = pop.offsetWidth;
  const left = Math.max(10, Math.min(
    cr.left - br.left + cr.width / 2 - w / 2, br.width - w - 10));
  pop.style.left = left + 'px';
  pop.style.top = (cr.bottom - br.top + 9) + 'px';
}

function hideChipPop() {
  const pop = document.getElementById('chipPop');
  if (pop) pop.hidden = true;
}

/* A short "why" panel shown after every answer. */
function explainCard(code, extra) {
  const a = aa(code);
  const cl = CLASSES[a.cls];
  return `
    <div class="explain" style="--hue:${cl.hue}">
      <div class="ex-head">
        <span class="pill">${a.code}</span>
        <div>
          <div class="ex-name">${esc(a.name)} <span class="dim">(${a.three})</span></div>
          <div class="ex-cls">${esc(cl.label)}</div>
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

/* -------------------------------------------------- question types */

function qStructToName() {
  const code = pickAA();
  const opts = shuffle([code, ...distractors(code, distractorCount())]);
  return {
    kind: 'mc', code, tag: 'Structure',
    prompt: 'Which amino acid is this?',
    svg: moleculeSVG(code, { form: S.form }),
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
    choices: opts.map(c => ({ value: c, svg: moleculeSVG(c, { form: S.form, plain: true }) })),
    answer: opts.indexOf(code),
    explainWith: `Look for: ${esc(a.group.toLowerCase())}.`
  };
}

/* One-letter codes are the must-know; recalling a full name from a
   letter, or a three-letter code from a drawing, is a step past that. */
const CODE_VARIANTS = [
  { y: HI,  id: 'name2one' },
  { y: HI,  id: 'three2one' },
  { y: MED, id: 'struct2three' },
  { y: MED, id: 'one2name' }
];

function qCodes() {
  const code = pickAA();
  const a = aa(code);
  const variant = pick(atYield(CODE_VARIANTS)).id;

  if (variant === 'name2one') {
    return {
      kind: 'type', code, tag: 'Abbreviation', maxlen: 1, wide: false,
      prompt: `One-letter code for <b>${esc(a.name)}</b>?`,
      placeholder: '?',
      check: v => v.trim().toUpperCase() === a.code,
      answerText: a.code,
      explainWith: 'Three-letter code: <b>' + a.three + '</b>'
    };
  }
  if (variant === 'three2one') {
    return {
      kind: 'type', code, tag: 'Abbreviation', maxlen: 1, wide: false,
      prompt: `<b>${a.three}</b> — what is the one-letter code?`,
      placeholder: '?',
      check: v => v.trim().toUpperCase() === a.code,
      answerText: a.code,
      explainWith: esc(a.name)
    };
  }
  if (variant === 'struct2three') {
    return {
      kind: 'type', code, tag: 'Abbreviation', maxlen: 3, wide: false,
      svg: moleculeSVG(code, { form: S.form }),
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
    placeholder: 'full name',
    check: v => nameMatches(v, a),
    answerText: a.name,
    explainWith: 'Three-letter code: <b>' + a.three + '</b>'
  };
}

function qClassify() {
  const code = pickAA();
  const a = aa(code);
  const opts = CLASS_ORDER.slice();
  return {
    kind: 'mc', code, tag: 'Class', columns: 1,
    prompt: `Which class does <b>${esc(a.name)}</b> belong to?`,
    svg: moleculeSVG(code, { form: S.form }),
    choices: opts.map(c => ({
      value: c,
      html: `<span class="swatch" style="--hue:${CLASSES[c].hue}"></span>${esc(CLASSES[c].label)}`
    })),
    answer: opts.indexOf(a.cls),
    explainWith: esc(CLASSES[a.cls].blurb)
  };
}

/* -- property questions ------------------------------------------- */

const FACTS = [
  { y: HI,  q: 'Which amino acid is the only achiral one?', a: 'G' },
  { y: HI,  q: 'Which amino acid forms disulfide bridges?', a: 'C' },
  { y: HI,  q: 'Which amino acid is encoded by the start codon AUG?', a: 'M' },
  { y: HI,  q: 'Which residue kinks α-helices because its side chain locks the backbone?', a: 'P' },
  { y: HI,  q: 'Which side chain has a pKa near 6, so it buffers at physiological pH?', a: 'H' },
  { y: HI,  q: 'Which side chain is the strongest base?', a: 'R' },
  { y: HI,  q: 'Sickle-cell disease swaps which residue at position 6 of β-globin?', a: 'E' },
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
  /* Needs at least two ionisable residues in play to be a real question. */
  if (ion.length < 2) return propCharge();
  const code = pick(ion);
  const a = aa(code);
  const opts = shuffle([code,
    ...sample(ion.filter(c => c !== code), distractorCount())]);
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
  /* Wrong answers are other groups drawn from the study set only. */
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
  /* Only ask about a class that still has a member in play AND enough
     residues outside it to act as wrong answers. */
  const usable = CLASS_ORDER.filter(cl =>
    act.some(c => aa(c).cls === cl) &&
    act.filter(c => aa(c).cls !== cl).length >= want);
  if (!usable.length) return propCharge();

  const cls = pick(usable);
  const code = pick(act.filter(c => aa(c).cls === cls));
  const out = sample(act.filter(c => aa(c).cls !== cls), want);
  const opts = shuffle([code, ...out]);
  return {
    kind: 'mc', code, tag: 'Class',
    prompt: `Which of these is <b>${esc(CLASSES[cls].label.toLowerCase())}</b>?`,
    choices: opts.map(c => ({ value: c, html: nameTag(c) })),
    answer: opts.indexOf(code),
    explainWith: esc(CLASSES[cls].blurb)
  };
}

/* Some residues share a value (Gly and Val are both pI 5.97). Pick the
   winner first, then draw the other three from strictly the other side,
   so a "highest / lowest" question can only have one right answer. */
function fourWithUniqueExtreme(key, wantMax) {
  const act = activeCodes();
  const want = distractorCount();
  for (const w of shuffle(act)) {
    const wv = aa(w)[key];
    const rest = act.filter(c => c !== w &&
      (wantMax ? aa(c)[key] < wv : aa(c)[key] > wv));
    if (rest.length >= want) return shuffle([w, ...sample(rest, want)]);
  }
  return null;   // every candidate ties; caller falls back
}

/* No hydropathy question: the Kyte–Doolittle scale is not MCAT content,
   and its sign disagrees with the polar/nonpolar classification taught
   in Classify mode for Cys, Trp, Gly and Pro. The values stay on the
   reference card, where they are context rather than a right answer. */

function propFact() {
  /* Only ask facts whose answer is still in the study set. */
  const pool = atYield(FACTS).filter(f => isActive(f.a));
  if (!pool.length) return propCharge();
  const f = pick(pool);
  const code = f.a;
  const opts = shuffle([code, ...distractors(code, distractorCount(), 0.4)]);
  return {
    kind: 'mc', code, tag: 'Biochemistry',
    prompt: f.q,
    choices: opts.map(c => ({ value: c, html: nameTag(c) })),
    answer: opts.indexOf(code),
    explainWith: esc(aa(code).note)
  };
}

/* propFact twice so trivia keeps roughly its old share of the mode. */
const PROP_QS = [
  { y: HI,  gen: propCharge },
  { y: HI,  gen: propPka },
  { y: HI,  gen: propClassMember },
  { y: HI,  gen: propFact },
  { y: HI,  gen: propFact },
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
    <tfoot><tr><td colspan="3">Net charge</td>
      <td class="q ${chgClass(net)}">${chargeStr(net)}</td></tr></tfoot>
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
  /* At high yield, stay at physiological pH — that is the version the
     exam asks. Wider pH ranges are the same skill, one step out. */
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
  if (!ion.length) return qChargeAtPH();   // nothing ionisable left in play
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
  /* Distractors must differ from the answer AND from each other —
     Gly and Val would otherwise both offer 5.97. */
  const want = distractorCount();
  const others = [];
  for (const x of shuffle(AAS.filter(x => isActive(x.code)))) {
    if (Math.abs(x.pI - a.pI) <= 0.7) continue;
    if (others.some(p => Math.abs(p - x.pI) < 0.05)) continue;
    others.push(x.pI);
    if (others.length === want) break;
  }
  if (!others.length) return qChargeAtPH();   // no separable pI to contrast
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
  if (!four) return piPair();   // every active residue ties on pI
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
  /* Far enough from the pI that the direction is unambiguous, and clear
     of every pKa so the breakdown table underneath is honest rather
     than rounding a half-titrated group to a whole charge. */
  const ladder = pKaLadder(code);
  const cands = PH_CHOICES.filter(p => Math.abs(p - a.pI) >= 0.8 &&
    ladder.every(g => Math.abs(p - g.pKa) >= 0.5));
  const pH = pick(cands.length ? cands
    : PH_CHOICES.filter(p => Math.abs(p - a.pI) >= 0.8));
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

/* piPair is the actual pI skill, so it survives at every level.
   Ranking four pIs against each other is the rarest of these. */
const PI_QS = [
  { y: HI,  gen: piPair },
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
  isoelectric: qIsoelectric,
  /* The only place the yield slider applies. The flag is on just for
     this call, so the sub-generators narrow themselves the way the
     slider asks; everywhere else they run unfiltered. */
  gauntlet: () => {
    yieldActive = true;
    try {
      return pick([qStructToName, qNameToStruct, qCodes,
                   qClassify, qProps, qChargeAtPH, qIsoelectric])();
    } finally {
      yieldActive = false;
    }
  }
};

/* ------------------------------------------------------------ views */

const app = () => document.getElementById('app');

function render() {
  /* The donation footer belongs on the menu only, not over a quiz. */
  const foot = document.querySelector('.sitefoot');
  if (foot) foot.hidden = S.screen !== 'home';

  if (S.screen === 'home') return renderHome();
  if (S.screen === 'quiz') return renderQuiz();
  if (S.screen === 'results') return renderResults();
  if (S.screen === 'study') return renderStudy();
}

function renderHome() {
  const pct = Math.round(overallMastery() * 100);
  const act = activeCodes();
  const seen = act.filter(c => stats[c] && stats[c].seen).length;

  app().innerHTML = `
    <section class="hero">
      <h1>Twenty amino acids, committed to memory</h1>
      <p class="sub">Structures are drawn from real bond geometry. The
      <span class="sc-word">side chain</span> is highlighted against the shared backbone,
      because that is the only part that changes.</p>
    </section>

    <section class="progress-band">
      <div class="pb-row">
        <div class="pb-num"><strong>${pct}%</strong><span>mastery</span></div>
        <div class="pb-grid">
          ${ALL_CODES.map(c => {
            const m = mastery(c);
            const a = aa(c);
            const off = !isActive(c);
            return `<button class="chip${off ? ' off' : ''}" data-chip="${c}"
                      style="--hue:${CLASSES[a.cls].hue};--m:${m}"
                      aria-pressed="${off ? 'false' : 'true'}"
                      aria-label="${esc(a.name)}, ${off ? 'skipped' : 'in play'}"
                      >${c}</button>`;
          }).join('')}
        </div>
        <div class="pb-num"><strong>${seen}/${act.length}</strong><span>encountered</span></div>
      </div>
      <div class="pb-foot">
        <span class="pb-hint">${S.off.length
          ? `<b>${S.off.length}</b> skipped — <button class="link" id="allOn">study all 20</button>`
          : 'Click a letter to leave it out of the games'}</span>
        <button class="link" id="reset">Reset progress</button>
      </div>
      <div class="chip-pop" id="chipPop" role="tooltip" hidden></div>
    </section>

    <section class="modes">
      ${MODES.map(m => m.id === 'gauntlet' ? `
        <div class="mode-card has-yield">
          <button class="mc-go" data-mode="gauntlet">
            <span class="glyph">${m.glyph}</span>
            <span class="mc-name">${m.name}</span>
            <span class="mc-desc">${m.desc}</span>
          </button>
          <label class="gy" id="yieldWrap">
            <span class="ym-label">MCAT yield</span>
            <input type="range" id="yieldRange" min="0" max="2" step="1"
                   value="${S.yield}" aria-label="MCAT yield level for the Gauntlet" />
            <span class="ym-now">${esc(YIELD_LEVELS[S.yield].name)}</span>
            <span class="ym-pop" role="tooltip">
              ${YIELD_LEVELS.map((l, i) => `<span class="ymp-row${i === S.yield ? ' on' : ''}"
                ><b>${esc(l.name)}</b>${esc(l.blurb)}</span>`).join('')}
            </span>
          </label>
        </div>` : `
        <button class="mode-card" data-mode="${m.id}">
          <span class="glyph">${m.glyph}</span>
          <span class="mc-name">${m.name}</span>
          <span class="mc-desc">${m.desc}</span>
        </button>`).join('')}
      <button class="mode-card study" data-mode="study">
        <span class="glyph">☰</span>
        <span class="mc-name">Reference table</span>
        <span class="mc-desc">All twenty side by side, with every property. Study first, then drill.</span>
      </button>
    </section>

    ${S.best ? `<p class="footnote">Best gauntlet score: <b>${S.best}</b></p>` : ''}
  `;

  app().querySelectorAll('[data-mode]').forEach(b => {
    b.onclick = () => {
      const m = b.dataset.mode;
      if (m === 'study') { S.screen = 'study'; render(); }
      else startRound(m);
    };
  });
  /* Patch the label in place rather than re-rendering — a full render
     would swap out the range element and kill an in-progress drag.
     The descriptions live in a hover card so the row itself stays quiet. */
  const range = document.getElementById('yieldRange');
  if (range) range.oninput = () => {
    S.yield = +range.value;
    save();
    document.querySelector('.ym-now').textContent = YIELD_LEVELS[S.yield].name;
    app().querySelectorAll('.ymp-row').forEach((row, i) =>
      row.classList.toggle('on', i === S.yield));
  };

  /* Chips: hover for the card, click to drop the residue from the games. */
  app().querySelectorAll('[data-chip]').forEach(chip => {
    chip.onmouseenter = () => showChipPop(chip);
    chip.onfocus = () => showChipPop(chip);
    chip.onmouseleave = hideChipPop;
    chip.onblur = hideChipPop;
    chip.onclick = () => {
      if (!toggleCode(chip.dataset.chip)) {
        /* At the floor — say so instead of silently ignoring the click. */
        const pop = document.getElementById('chipPop');
        if (pop && !pop.hidden) {
          const act = pop.querySelector('.cp-act');
          if (act) {
            act.textContent = `Keep at least ${MIN_ACTIVE} in play`;
            act.classList.add('is-warn');
          }
        }
        return;
      }
      render();
      /* Re-open the card on the same chip so the new state is visible. */
      const again = app().querySelector(`[data-chip="${chip.dataset.chip}"]`);
      if (again) showChipPop(again);
    };
  });

  const allOn = document.getElementById('allOn');
  if (allOn) allOn.onclick = () => { S.off = []; save(); render(); };

  const rst = document.getElementById('reset');
  if (rst) rst.onclick = () => {
    if (confirm('Clear all progress and start over?')) {
      stats = {}; S.best = 0; save(); render();
    }
  };
}

function startRound(mode) {
  S.mode = mode;
  S.screen = 'quiz';
  S.idx = 0;
  S.score = 0;
  S.streak = 0;
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
    if (S.score > S.best) { S.best = S.score; save(); }
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
  const total = timed ? '∞' : ROUND_LEN;

  app().innerHTML = `
    <div class="quizbar">
      <button class="link" id="quit">← Menu</button>
      <div class="qb-mid">
        <span class="tag">${q.tag}</span>
        <span class="dim">${timed ? `Q${S.idx + 1}` : `${S.idx + 1} / ${total}`}</span>
      </div>
      <div class="qb-right">
        ${timed ? `<span class="clock" id="clock">${S.timeLeft}s</span>` : ''}
        <span class="score">${S.score}</span>
        ${S.streak > 1 ? `<span class="streak">🔥${S.streak}</span>` : ''}
      </div>
    </div>

    <div class="card">
      <p class="prompt">${q.prompt}</p>
      ${q.svg ? `<div class="stage">${q.svg}</div>` : ''}
      <div id="answers"></div>
      <div id="feedback"></div>
    </div>
  `;

  document.getElementById('quit').onclick = () => {
    clearInterval(S.timer); S.timer = null;
    S.screen = 'home'; render();
  };

  const box = document.getElementById('answers');

  if (q.kind === 'type') {
    box.innerHTML = `
      <form class="typebox" id="tf" autocomplete="off">
        <input id="tin" class="${q.wide ? 'wide' : 'narrow'}"
               maxlength="${q.maxlen}" placeholder="${esc(q.placeholder)}"
               spellcheck="false" autocapitalize="off" />
        <button type="submit" class="btn">Check</button>
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
    box.innerHTML = `<div class="grid-svg">` + q.choices.map((c, i) =>
      `<button class="opt-svg" data-i="${i}"><span class="num">${i + 1}</span>${c.svg}</button>`
    ).join('') + `</div>`;
    box.querySelectorAll('button').forEach(b =>
      b.onclick = () => choose(+b.dataset.i));
  } else {
    box.innerHTML = `<div class="opts ${q.columns === 1 ? 'one' : ''}">` +
      q.choices.map((c, i) =>
        `<button class="opt" data-i="${i}"><span class="num">${i + 1}</span><span class="opt-body">${c.html}</span></button>`
      ).join('') + `</div>`;
    box.querySelectorAll('button').forEach(b =>
      b.onclick = () => choose(+b.dataset.i));
  }
}

function submitTyped(value) {
  const q = S.q;
  const ok = q.check(value);
  S.answered = true;
  record(q.code, ok);
  finishAnswer(ok, ok ? '' : `You wrote “${esc(value || '—')}”. The answer is <b>${esc(q.answerText)}</b>.`);
  const input = document.getElementById('tin');
  if (input) {
    input.classList.add(ok ? 'good' : 'bad');
    input.disabled = true;
  }
}

function choose(i) {
  if (S.answered) return;
  S.answered = true;
  const q = S.q;
  const ok = i === q.answer;
  record(q.code, ok);

  const box = document.getElementById('answers');
  box.querySelectorAll('button').forEach((b, j) => {
    b.disabled = true;
    if (j === q.answer) b.classList.add('good');
    else if (j === i) b.classList.add('bad');
  });
  finishAnswer(ok, '');
}

function finishAnswer(ok, extraMsg) {
  if (ok) { S.score++; S.streak++; }
  else { S.streak = 0; S.missed.push(S.q.code); }

  const fb = document.getElementById('feedback');
  fb.innerHTML = `
    <div class="verdict ${ok ? 'ok' : 'no'}">
      <span>${ok ? 'Correct' : 'Not quite'}</span>
      ${extraMsg ? `<em>${extraMsg}</em>` : ''}
    </div>
    ${explainCard(S.q.code, S.q.explainWith)}
    <button class="btn primary wide-btn" id="next">
      ${(S.mode !== 'gauntlet' && S.idx + 1 >= ROUND_LEN) ? 'See results' : 'Next'}
      <span class="kbd">↵</span>
    </button>`;
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
    <div class="results">
      <p class="dim">${esc(modeName)}</p>
      <div class="big-score">${S.score}<span>/ ${asked}</span></div>
      <div class="ring">${pct}% correct</div>
      ${S.mode === 'gauntlet' && S.score >= S.best && S.score > 0
        ? `<p class="best">New best.</p>` : ''}

      ${missedUnique.length ? `
        <h3>Worth another look</h3>
        <div class="missed">
          ${missedUnique.map(c => `
            <div class="missed-card" style="--hue:${CLASSES[aa(c).cls].hue}">
              <div class="ms-mol">${moleculeSVG(c, { form: S.form, plain: true })}</div>
              <div class="ms-body">
                <b>${esc(aa(c).name)}</b>
                <span class="dim">${aa(c).three} · ${aa(c).code}</span>
                <span class="ms-note">${esc(aa(c).mnemonic)}</span>
              </div>
            </div>`).join('')}
        </div>` : `<p class="clean">Clean sweep — nothing missed.</p>`}

      <div class="res-actions">
        <button class="btn primary" id="again">Go again</button>
        <button class="btn" id="home">Menu</button>
      </div>
    </div>`;

  document.getElementById('again').onclick = () => startRound(S.mode);
  document.getElementById('home').onclick = () => { S.screen = 'home'; render(); };
}

/* ------------------------------------------------------------ study */

let studyFilter = 'all';

function renderStudy() {
  const list = studyFilter === 'all'
    ? AAS
    : AAS.filter(a => a.cls === studyFilter);

  app().innerHTML = `
    <div class="quizbar">
      <button class="link" id="quit">← Menu</button>
      <div class="qb-mid"><span class="tag">Reference</span></div>
      <div class="qb-right">
        <button class="toggle" id="formtog" title="Switch between the neutral form and the form at pH 7">
          ${S.form === 'ion' ? 'pH 7 (zwitterion)' : 'Neutral form'}
        </button>
      </div>
    </div>

    <div class="filters">
      <button class="fbtn ${studyFilter === 'all' ? 'on' : ''}" data-f="all">All 20</button>
      ${CLASS_ORDER.map(c => `
        <button class="fbtn ${studyFilter === c ? 'on' : ''}" data-f="${c}"
                style="--hue:${CLASSES[c].hue}">
          <span class="swatch" style="--hue:${CLASSES[c].hue}"></span>${esc(CLASSES[c].short)}
        </button>`).join('')}
    </div>

    <div class="study-grid">
      ${list.map(a => {
        const cl = CLASSES[a.cls];
        const m = mastery(a.code);
        return `
        <article class="aacard" style="--hue:${cl.hue}">
          <header>
            <span class="pill">${a.code}</span>
            <div class="ac-title">
              <h3>${esc(a.name)}</h3>
              <span class="dim">${a.three}${a.alt.length ? ' · ' + esc(a.alt[0]) : ''}</span>
            </div>
            <span class="mastery" title="${Math.round(m * 100)}% mastered">
              <span style="width:${m * 100}%"></span>
            </span>
          </header>
          <div class="ac-mol">${moleculeSVG(a.code, { form: S.form })}</div>
          <div class="ac-cls">${esc(cl.label)}</div>
          <dl class="ac-props">
            <div><dt>Side chain</dt><dd>${esc(a.group)}</dd></div>
            <div><dt>Charge (pH 7)</dt><dd>${chargeLabel(a)}</dd></div>
            <div><dt>Side-chain pKa</dt><dd>${a.pKaR ? a.pKaR.toFixed(2) : '—'}</dd></div>
            <div><dt>pI</dt><dd>${a.pI.toFixed(2)}</dd></div>
            <div><dt>M<sub>r</sub></dt><dd>${a.mw.toFixed(2)}</dd></div>
            <div><dt>Hydropathy</dt><dd>${a.hydropathy > 0 ? '+' : ''}${a.hydropathy}</dd></div>
            <div><dt>Diet</dt><dd>${essentialLabel(a)}</dd></div>
            <div><dt>Codons</dt><dd class="codons">${a.codons.join(' ')}</dd></div>
          </dl>
          <p class="ac-mnem">${esc(a.mnemonic)}</p>
          <p class="ac-note">${esc(a.note)}</p>
        </article>`;
      }).join('')}
    </div>`;

  document.getElementById('quit').onclick = () => { S.screen = 'home'; render(); };
  document.getElementById('formtog').onclick = () => {
    S.form = S.form === 'ion' ? 'neutral' : 'ion';
    save(); render();
  };
  app().querySelectorAll('[data-f]').forEach(b =>
    b.onclick = () => { studyFilter = b.dataset.f; render(); });
}

/* -------------------------------------------------------- keyboard */

document.addEventListener('keydown', e => {
  if (S.screen !== 'quiz') return;
  const typing = document.activeElement &&
    document.activeElement.tagName === 'INPUT';

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

load();
render();
