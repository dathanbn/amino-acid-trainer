/* ------------------------------------------------------------------
   verify.js — correctness checks for the trainer.  `node verify.js`

   No dependencies and no browser: the data and chemistry layers are
   plain scripts, so they run in a bare VM context with a stub DOM.

   Checks, in order:
     1  molecular formula of all 20 structures, from the drawn bonds
     2  every atom's valence closes
     3  bond lengths and angles
     4  no text label collides with a bond or another label
     5  pI derived from the pKa ladder matches the published value
     6  net charge against hand-worked textbook cases
     7  charge7 in the data agrees with the pKa model
     8  every question generator, at every yield level
     9  no out-of-scope material reachable from a game
    10  offline bundle is in sync with the source
   ------------------------------------------------------------------ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failures = 0;
const pass = m => console.log('  ok    ' + m);
const fail = m => { failures++; console.log('  FAIL  ' + m); };
const head = m => console.log('\n' + m);

/* Load the app into a sandbox with just enough DOM to boot. */
const ctx = vm.createContext({
  console,
  document: { addEventListener() {}, querySelector: () => null, getElementById: () => null },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
});
vm.runInContext(read('js/data.js'), ctx);
vm.runInContext(read('js/chem.js'), ctx);
vm.runInContext(read('js/app.js').replace(/load\(\);\s*render\(\);\s*$/, ''), ctx);
const run = expr => vm.runInContext(expr, ctx);

/* ---------------------------------------------- 1-2  structures */

head('Structures — formula and valence');

const FORMULA = {
  G: 'C2H5NO2', A: 'C3H7NO2', V: 'C5H11NO2', L: 'C6H13NO2', I: 'C6H13NO2',
  P: 'C5H9NO2', M: 'C5H11NO2S', F: 'C9H11NO2', Y: 'C9H11NO3', W: 'C11H12N2O2',
  S: 'C3H7NO3', T: 'C4H9NO3', C: 'C3H7NO2S', N: 'C4H8N2O3', Q: 'C5H10N2O3',
  D: 'C4H7NO4', E: 'C5H9NO4', K: 'C6H14N2O2', R: 'C6H14N4O2', H: 'C6H9N3O2'
};

const chem = run(`(function(){
  const SUB = {'₀':0,'₁':1,'₂':2,'₃':3,'₄':4,
               '₅':5,'₆':6,'₇':7,'₈':8,'₉':9};
  const VAL = { C:4, N:3, O:2, S:2, H:1 };
  const hFromLabel = at => {
    if (!at.text) return null;
    const m = at.text.match(/H([₀-₉])?/);
    if (!m) return 0;
    return m[1] !== undefined ? SUB[m[1]] : 1;
  };
  const out = {};
  for (const code of ALL_CODES) {
    const M = buildAA(code, false);
    const sum = {}; M.list.forEach(a => sum[a.id] = 0);
    M.bonds.forEach(b => { sum[b.a] += b.order; sum[b.b] += b.order; });

    const cnt = { C:0, H:0, N:0, O:0, S:0 }, bad = [];
    for (const at of M.list) {
      cnt[at.el] = (cnt[at.el] || 0) + 1;
      let h;
      if (at.el === 'H') h = 0;
      else { const lab = hFromLabel(at); h = lab === null ? VAL[at.el] - sum[at.id] : lab; }
      if (at.el !== 'H' && sum[at.id] + h !== VAL[at.el])
        bad.push(at.id + '(' + at.el + ') valence ' + (sum[at.id] + h));
      if (at.el === 'H' && sum[at.id] !== 1) bad.push(at.id + ' H with ' + sum[at.id] + ' bonds');
      cnt.H += h;
    }

    const badLen = M.bonds.filter(b => {
      const A = M.get(b.a), B = M.get(b.b);
      return Math.abs(Math.hypot(B.x - A.x, B.y - A.y) - 1) > 0.02;
    }).map(b => b.a + '-' + b.b);

    const nb = {}; M.list.forEach(a => nb[a.id] = []);
    M.bonds.forEach(b => { nb[b.a].push(b.b); nb[b.b].push(b.a); });
    const angles = [];
    for (const at of M.list) {
      const ns = nb[at.id];
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        const A = M.get(ns[i]), B = M.get(ns[j]);
        const v1 = [A.x - at.x, A.y - at.y], v2 = [B.x - at.x, B.y - at.y];
        angles.push(Math.acos(Math.max(-1, Math.min(1,
          (v1[0]*v2[0] + v1[1]*v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))))) * 180 / Math.PI);
      }
    }
    out[code] = {
      formula: ['C','H','N','O','S'].filter(e => cnt[e])
        .map(e => e + (cnt[e] > 1 ? cnt[e] : '')).join(''),
      bad, badLen, minAngle: Math.min(...angles)
    };
  }
  return out;
})()`);

let formulaBad = 0, valenceBad = 0, geomBad = 0;
for (const code of Object.keys(FORMULA)) {
  const r = chem[code];
  if (r.formula !== FORMULA[code]) { formulaBad++; fail(code + ' formula ' + r.formula + ', expected ' + FORMULA[code]); }
  if (r.bad.length) { valenceBad++; fail(code + ' ' + r.bad.join('; ')); }
  if (r.badLen.length) { geomBad++; fail(code + ' bond length ' + r.badLen.join(',')); }
  if (r.minAngle < 95) { geomBad++; fail(code + ' bond angle ' + r.minAngle.toFixed(1) + '°'); }
}
if (!formulaBad) pass('all 20 molecular formulas match the published values');
if (!valenceBad) pass('every atom closes its valence');
if (!geomBad) pass('all bonds are unit length, no angle below 95°');

/* ------------------------------------------------- 4  labels */

head('Structures — label collisions');
const collisions = run(`(function(){
  function segRect(p1, p2, r) {
    const inside = p => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
    if (inside(p1) || inside(p2)) return true;
    const s = (x, y, z) => Math.sign((y.x-x.x)*(z.y-x.y) - (y.y-x.y)*(z.x-x.x));
    const seg = (a,b,c,d) => s(a,b,c) !== s(a,b,d) && s(c,d,a) !== s(c,d,b);
    const C = [{x:r.x0,y:r.y0},{x:r.x1,y:r.y0},{x:r.x1,y:r.y1},{x:r.x0,y:r.y1}];
    for (let i = 0; i < 4; i++) if (seg(p1, p2, C[i], C[(i+1)%4])) return true;
    return false;
  }
  const hits = [];
  for (const ion of [false, true]) for (const code of ALL_CODES) {
    const M = buildAA(code, ion);
    const boxes = {};
    for (const at of M.list) {
      if (!at.text) continue;
      const e = extent(at);
      boxes[at.id] = { x0: at.x-e.l, x1: at.x+e.r, y0: at.y-e.u, y1: at.y+e.d };
    }
    for (const id in boxes) for (const b of M.bonds) {
      if (b.a === id || b.b === id) continue;
      const A = M.get(b.a), B = M.get(b.b);
      let dx = B.x-A.x, dy = B.y-A.y; const L = Math.hypot(dx,dy); dx/=L; dy/=L;
      const tA = trim(A,dx,dy), tB = trim(B,dx,dy);
      if (segRect({x:A.x+dx*tA, y:A.y+dy*tA}, {x:B.x-dx*tB, y:B.y-dy*tB}, boxes[id]))
        hits.push((ion?'ion ':'neutral ') + code + ' bond ' + b.a + '-' + b.b + ' through ' + id);
    }
    const ids = Object.keys(boxes);
    for (let i = 0; i < ids.length; i++) for (let j = i+1; j < ids.length; j++) {
      const a = boxes[ids[i]], b = boxes[ids[j]];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1)
        hits.push((ion?'ion ':'neutral ') + code + ' labels ' + ids[i] + '/' + ids[j] + ' overlap');
    }
  }
  return hits;
})()`);
collisions.length ? collisions.forEach(fail)
                  : pass('no label overlaps a bond or another label, in either pH form');

/* -------------------------------------------- 5-7  ionisation */

head('Ionisation — pI, charge, and data consistency');

const piRows = run(`ALL_CODES.map(c => {
  const r = computePI(c);
  return { c, stored: aa(c).pI, calc: r.pI, diff: Math.abs(r.pI - aa(c).pI) };
})`);
const piBad = piRows.filter(r => r.diff >= 0.006);
piBad.length ? piBad.forEach(r => fail(r.c + ' pI computed ' + r.calc.toFixed(3) + ' vs stored ' + r.stored))
             : pass('all 20 pI values reproduce from the pKa ladder (within 0.005)');

const cross = run(`ALL_CODES.filter(c => {
  const p = computePI(c).pI;
  return netChargeAt(c, p - 0.01) !== 0 || netChargeAt(c, p + 0.01) !== 0;
})`);
cross.length ? fail('net charge is not zero either side of pI for ' + cross.join(','))
             : pass('net charge is zero on both sides of every pI');

const HAND = [['K',1,2],['K',7,1],['K',12,-1],['D',7,-1],['D',11,-2],['D',1,1],
              ['H',7,0],['H',4,1],['H',11,-1],['G',7,0],['G',1,1],['G',12,-1],
              ['R',7,1],['R',13,-1],['E',7,-1],['C',7,0],['C',12,-2],
              ['Y',7,0],['Y',11,-2],['F',7,0],['P',1,1]];
const handBad = HAND.filter(([c, ph, want]) => run(`netChargeAt('${c}', ${ph})`) !== want);
handBad.length ? handBad.forEach(([c,ph,w]) => fail(c + ' at pH ' + ph + ' should be ' + w))
               : pass(HAND.length + ' hand-worked charge cases all correct');

const clash = run(`ALL_CODES.filter(c => aa(c).pKaR).filter(c => {
  const a = aa(c), acid = R_ACIDIC.includes(c);
  return (acid ? (7 > a.pKaR ? -1 : 0) : (7 < a.pKaR ? 1 : 0)) !== a.charge7;
})`);
clash.length ? fail('charge7 disagrees with the pKa model for ' + clash.join(','))
             : pass('charge7 in the data agrees with the pKa model');

const overlap = run(`R_ACIDIC.filter(c => R_BASIC.includes(c))
  .concat(ALL_CODES.filter(c => aa(c).pKaR && !R_ACIDIC.includes(c) && !R_BASIC.includes(c)))`);
overlap.length ? fail('R_ACIDIC / R_BASIC do not partition the ionisable side chains: ' + overlap.join(','))
               : pass('R_ACIDIC and R_BASIC partition the seven ionisable side chains');

/* ------------------------------------------- 8-9  generators */

head('Question generators');

const gen = run(`(function(){
  const res = {}, errs = [];
  const BANNED = {
    'Kyte-Doolittle': /kyte/i,
    'hydropathy ranking': /hydropath|most hydroph/i,
    'essential / diet': /\\bessential\\b|\\bdiet\\b/i,
    'codon memorisation': /\\bcodons\\b/i,
    'molecular weight': /molecular weight/i,
    'glycosylation sequon': /sequon/i
  };
  const leaks = new Set();
  const before = S.yield;
  for (let lvl = 0; lvl < 3; lvl++) {
    S.yield = lvl;
    const shapes = new Set(), tags = {};
    for (const name of Object.keys(GENERATORS)) {
      for (let i = 0; i < 3000; i++) {
        let q;
        try { q = GENERATORS[name](); }
        catch (e) { errs.push(name + '@' + lvl + ' threw: ' + e.message); break; }
        tags[q.tag] = (tags[q.tag] || 0) + 1;
        shapes.add(q.prompt.replace(/<[^>]+>/g,'').replace(/[\\d.]+/g,'#').trim());
        if (!aa(q.code)) errs.push(name + ' bad code');
        if (!q.prompt) errs.push(name + ' empty prompt');
        if (!q.explainWith) errs.push(name + ' no explanation');
        if (q.kind === 'mc' || q.kind === 'mc-svg') {
          if (q.answer == null || q.answer < 0 || q.answer >= q.choices.length)
            errs.push(name + ' answer index out of range');
          const v = q.choices.map(c => String(c.value));
          if (new Set(v).size !== v.length) errs.push(name + ' duplicate choice values');
          if (q.kind === 'mc') {
            const t = q.choices.map(c => String(c.html||'').replace(/<[^>]+>/g,'').trim());
            if (new Set(t).size !== t.length) errs.push(name + ' duplicate choice labels');
          }
        }
        if (q.kind === 'type') {
          if (!q.check(q.answerText)) errs.push(name + ' check rejects its own answer');
          if (q.check('zzzz')) errs.push(name + ' check accepts garbage');
        }
        const m = /pH ([\\d.]+)/.exec(q.prompt.replace(/<[^>]+>/g,''));
        if (m && (q.tag === 'Charge at pH' || q.tag === 'Electrophoresis')) {
          const ph = parseFloat(m[1]);
          if (pKaLadder(q.code).some(g => Math.abs(ph - g.pKa) < 0.5))
            errs.push(name + ' pH ' + ph + ' sits within 0.5 of a pKa of ' + q.code);
        }
        const flat = (q.prompt + ' ' + (q.explainWith||'') + ' ' +
          (q.choices||[]).map(c => c.html||'').join(' ')).replace(/<[^>]+>/g,' ');
        for (const [label, re] of Object.entries(BANNED)) if (re.test(flat)) leaks.add(label);
      }
    }
    const empty = Object.keys(GENERATORS).filter(n => { try { return !GENERATORS[n](); } catch(e) { return true; } });
    res[lvl] = { level: YIELD_LEVELS[lvl].name, shapes: shapes.size, tags: Object.keys(tags).length, empty };
  }
  S.yield = before;
  return { res, errs: [...new Set(errs)], leaks: [...leaks] };
})()`);

for (const lvl of [0, 1, 2]) {
  const r = gen.res[lvl];
  const note = r.level + ': ' + r.shapes + ' distinct question shapes, ' + r.tags + ' tags';
  r.empty.length ? fail(note + ' — these produce nothing: ' + r.empty.join(',')) : pass(note);
}
gen.errs.length ? gen.errs.forEach(fail) : pass('27,000 generated questions, no malformed output');
gen.leaks.length ? gen.leaks.forEach(l => fail('out-of-scope material reachable in a game: ' + l))
                 : pass('no out-of-scope material reachable from any game');

/* ------------------------------- yield scoping (Gauntlet only) */

head('Yield slider scope');

const scope = run(`(function(){
  const before = S.yield;
  const shapes = (mode, lvl) => {
    S.yield = lvl;
    const s = new Set();
    for (let i = 0; i < 6000; i++) {
      const q = GENERATORS[mode]();
      s.add(q.tag + '|' + q.prompt.replace(/<[^>]+>/g,'').replace(/[\\d.]+/g,'#')
        .replace(/\\b[A-Z][a-z]{2}\\b/g,'~').trim());
    }
    return s;
  };
  const standalone = Object.keys(GENERATORS).filter(m => m !== 'gauntlet');
  const drift = [];
  for (const m of standalone) {
    const a = [...shapes(m, 0)].sort().join('\\n');
    const c = [...shapes(m, 2)].sort().join('\\n');
    if (a !== c) drift.push(m);
  }
  const g = [0,1,2].map(l => shapes('gauntlet', l).size);
  // every standalone mode must serve its full range regardless
  S.yield = 0;
  const full = standalone.map(m => ({ m, n: shapes(m, 0).size }));
  S.yield = before;
  return { drift, gauntlet: g, full };
})()`);

scope.drift.length
  ? scope.drift.forEach(m => fail(m + ' changes with the slider but should not'))
  : pass('all 7 standalone modes serve identical questions at every slider position');

const [g0, g1, g2] = scope.gauntlet;
(g0 < g1 && g1 <= g2)
  ? pass('Gauntlet does respond to the slider: ' + g0 + ' / ' + g1 + ' / ' + g2 + ' question shapes')
  : fail('Gauntlet is not narrowing as expected: ' + scope.gauntlet.join(' / '));

const empty = scope.full.filter(f => f.n === 0).map(f => f.m);
empty.length ? fail('modes producing nothing: ' + empty.join(', '))
             : pass('every mode is always playable (no greying)');

/* ------------------------------------------ study-set subsets */

head('Study set (chips switched off)');

const subset = run(`(function(){
  const before = S.off.slice(), errs = [], tried = [];
  const modes = Object.keys(GENERATORS);

  /* Adversarial sets, not just random ones: a single class, only
     non-ionisable residues, exactly the floor, and the pI ties. */
  const cases = [
    ['all 20', []],
    ['floor of 2', ALL_CODES.slice(2)],
    ['3 left', ALL_CODES.slice(3)],
    ['only nonpolar aliphatic', ALL_CODES.filter(c => aa(c).cls !== 'aliphatic')],
    ['only acidic (2)', ALL_CODES.filter(c => aa(c).cls !== 'acidic')],
    ['no ionisable side chains', ALL_CODES.filter(c => aa(c).pKaR)],
    ['only ionisable side chains', ALL_CODES.filter(c => !aa(c).pKaR)],
    ['Gly + Val (pI tie)', ALL_CODES.filter(c => c !== 'G' && c !== 'V')],
    ['Leu + Ile (Mr tie)', ALL_CODES.filter(c => c !== 'L' && c !== 'I')]
  ];
  for (let i = 0; i < 40; i++) {
    const keep = 2 + Math.floor(Math.random() * 18);
    const shuffled = ALL_CODES.slice().sort(() => Math.random() - 0.5);
    cases.push(['random keep ' + keep, shuffled.slice(keep)]);
  }

  for (const [label, off] of cases) {
    S.off = off.slice();
    const act = activeCodes();
    if (act.length < MIN_ACTIVE) continue;
    tried.push(label);
    for (const m of modes) {
      for (let i = 0; i < 900; i++) {
        let q;
        try { q = GENERATORS[m](); }
        catch (e) { errs.push(label + ' / ' + m + ' threw: ' + e.message); break; }
        if (!q || !q.code) { errs.push(label + ' / ' + m + ' returned nothing'); break; }
        // the residue asked about must be in the study set
        if (!isActive(q.code)) errs.push(label + ' / ' + m + ' asked about skipped ' + q.code);
        if (q.kind === 'mc' || q.kind === 'mc-svg') {
          if (q.answer == null || q.answer < 0 || q.answer >= q.choices.length)
            errs.push(label + ' / ' + m + ' bad answer index');
          if (q.choices.length < 2) errs.push(label + ' / ' + m + ' only ' + q.choices.length + ' choice');
          const v = q.choices.map(c => String(c.value));
          if (new Set(v).size !== v.length) errs.push(label + ' / ' + m + ' duplicate choices');
          // no skipped residue may appear as a wrong answer either
          for (const c of q.choices) {
            if (typeof c.value === 'string' && c.value.length === 1 &&
                ALL_CODES.includes(c.value) && !isActive(c.value))
              errs.push(label + ' / ' + m + ' offered skipped ' + c.value + ' as a choice');
          }
        }
        if (q.kind === 'type' && !q.check(q.answerText))
          errs.push(label + ' / ' + m + ' check rejects its own answer');
      }
    }
  }
  S.off = before;
  return { errs: [...new Set(errs)].slice(0, 10), cases: tried.length };
})()`);

subset.errs.length
  ? subset.errs.forEach(fail)
  : pass(subset.cases + ' study-set configurations x 8 modes, no failures and no skipped residue ever shown');

const floor = run(`(function(){
  const before = S.off.slice();
  S.off = ALL_CODES.slice(2);
  const blocked = toggleCode(activeCodes()[0]) === false && activeCodes().length === MIN_ACTIVE;
  S.off = ALL_CODES.slice(1);            // 1 left: below the floor
  const repaired = (function(){ const bad = activeCodes().length < MIN_ACTIVE; return bad; })();
  S.off = before;
  return { blocked, repaired };
})()`);
floor.blocked ? pass('cannot drop below ' + run('MIN_ACTIVE') + ' residues in play')
              : fail('the minimum study-set size is not enforced');

/* --------------------------------------------- 10  bundle */

head('Offline bundle');
try {
  execFileSync(process.execPath, [path.join(ROOT, 'build.js'), '--check'], { stdio: 'pipe' });
  pass('offline/amino-acid-trainer.html matches the source');
} catch (e) {
  fail('offline bundle is stale — run `node build.js`');
}

/* ---------------------------------------------------- result */

console.log('\n' + (failures
  ? failures + ' CHECK' + (failures > 1 ? 'S' : '') + ' FAILED'
  : 'all checks passed'));
process.exit(failures ? 1 : 0);
