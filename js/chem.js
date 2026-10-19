/* ------------------------------------------------------------------
   chem.js — builds each amino acid from bond vectors and renders it
   as an SVG skeletal formula.

   Everything is laid out on a unit-bond-length grid with proper 120°
   angles. The backbone is identical for all twenty; only the side
   chain differs, and the side chain is tagged so it can be coloured
   separately — that contrast is the whole point of the drawing.
   ------------------------------------------------------------------ */

const DIR = {
  u:  [0, -1],
  d:  [0, 1],
  ur: [0.866, -0.5],
  dr: [0.866, 0.5],
  ul: [-0.866, -0.5],
  dl: [-0.866, 0.5]
};

function Mol() {
  const map = {};
  const list = [];
  const bonds = [];

  const M = {
    list, bonds,
    get(id) { return map[id]; },

    put(id, x, y, o = {}) {
      const at = {
        id, x, y,
        el: o.el || 'C',
        text: o.text || null,
        anchor: o.anchor || 'middle',
        side: !!o.side
      };
      map[id] = at;
      list.push(at);
      return M;
    },

    /* place a new atom one bond length from `from` in direction `dir` */
    go(from, dir, id, o = {}) {
      const f = map[from];
      const v = Array.isArray(dir) ? dir : DIR[dir];
      M.put(id, f.x + v[0], f.y + v[1], o);
      M.bond(from, id, o.order || 1);
      return M;
    },

    bond(a, b, order = 1, inner = null) {
      bonds.push({ a, b, order, inner, side: map[a].side || map[b].side });
      return M;
    },

    /* upgrade an existing bond to a double bond */
    dbl(a, b, inner = null) {
      const bd = bonds.find(x =>
        (x.a === a && x.b === b) || (x.a === b && x.b === a));
      if (bd) { bd.order = 2; bd.inner = inner; }
      return M;
    }
  };
  return M;
}

/* A regular n-ring hanging off `ipso`, growing away from `from`.
   `ids` holds the n-1 new atom ids in ring order.                   */
function attachRing(M, ipso, from, n, ids, o = {}) {
  const P = M.get(ipso), F = M.get(from);
  let vx = P.x - F.x, vy = P.y - F.y;
  const L = Math.hypot(vx, vy); vx /= L; vy /= L;

  const R = 0.5 / Math.sin(Math.PI / n);
  const cx = P.x + vx * R, cy = P.y + vy * R;
  const a0 = Math.atan2(P.y - cy, P.x - cx);
  const step = 2 * Math.PI / n;

  const verts = [ipso];
  ids.forEach((id, i) => {
    const a = a0 + step * (i + 1);
    M.put(id, cx + R * Math.cos(a), cy + R * Math.sin(a), o);
    verts.push(id);
  });
  for (let i = 0; i < verts.length; i++) {
    M.bond(verts[i], verts[(i + 1) % verts.length]);
  }
  return { verts, c: [cx, cy] };
}

/* A ring fused onto the existing bond aId–bId, built on the side of
   that bond facing away from the point `away`.
   `ids` holds the n-2 new atom ids, ordered from bId round to aId.  */
function fuseRing(M, aId, bId, n, ids, away, o = {}) {
  const A = M.get(aId), B = M.get(bId);
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;

  let px = -(B.y - A.y), py = B.x - A.x;
  const L = Math.hypot(px, py); px /= L; py /= L;
  if ((mx - away[0]) * px + (my - away[1]) * py < 0) { px = -px; py = -py; }

  const R = 0.5 / Math.sin(Math.PI / n);
  const ap = 0.5 / Math.tan(Math.PI / n);
  const cx = mx + px * ap, cy = my + py * ap;

  const aB = Math.atan2(B.y - cy, B.x - cx);
  const aA = Math.atan2(A.y - cy, A.x - cx);
  let diff = aA - aB;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const step = -Math.sign(diff) * 2 * Math.PI / n;

  const verts = [bId];
  ids.forEach((id, i) => {
    const ang = aB + step * (i + 1);
    M.put(id, cx + R * Math.cos(ang), cy + R * Math.sin(ang), o);
    verts.push(id);
  });
  verts.push(aId);
  for (let i = 0; i < verts.length - 1; i++) M.bond(verts[i], verts[i + 1]);
  return { verts, c: [cx, cy] };
}

/* ------------------------------------------------------------------
   The shared backbone.  Cα sits at the origin; the amino group runs
   down-left, the carboxyl down-right, and the side chain hangs
   straight down.  All three angles are 120°.
   ------------------------------------------------------------------ */
function backbone(M, iso) {
  M.put('CA', 0, 0);
  M.put('N', -0.866, -0.5, {
    el: 'N', text: iso ? 'H₃N⁺' : 'H₂N', anchor: 'end'
  });
  M.bond('N', 'CA');
  M.put('C', 0.866, -0.5);
  M.bond('CA', 'C');
  M.put('O1', 0.866, -1.5, { el: 'O', text: 'O' });
  M.bond('C', 'O1', 2);
  M.put('O2', 1.732, 0, {
    el: 'O', text: iso ? 'O⁻' : 'OH', anchor: 'start'
  });
  M.bond('C', 'O2');
}

/* R marks every side-chain atom so the renderer can colour it. */
const R = { side: true };
const RN = { side: true, el: 'N' };
const RO = { side: true, el: 'O' };
const RS = { side: true, el: 'S' };

/* ------------------------------------------------------------------
   Side chains.  Each receives the molecule (backbone already built)
   and a flag for the pH-7 / ionised depiction.
   ------------------------------------------------------------------ */
const SIDECHAIN = {

  G(M) {
    M.go('CA', 'd', 'HB', { ...R, el: 'H', text: 'H' });
  },

  A(M) {
    M.go('CA', 'd', 'CB', R);
  },

  V(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG1', R)
     .go('CB', 'dr', 'CG2', R);
  },

  L(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R)
     .go('CG', 'd', 'CD1', R)
     .go('CG', 'ul', 'CD2', R);
  },

  I(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG1', R)
     .go('CG1', 'd', 'CD1', R)
     .go('CB', 'dr', 'CG2', R);
  },

  P(M, iso) {
    /* the side chain closes back onto the backbone nitrogen */
    M.get('N').text = iso ? 'H₂N⁺' : 'HN';
    M.get('N').anchor = 'middle';
    fuseRing(M, 'CA', 'N', 5, ['CB', 'CG', 'CD'], [0.866, -0.5], R);
  },

  M(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R)
     .go('CG', 'd', 'SD', { ...RS, text: 'S' })
     .go('SD', 'dl', 'CE', R);
  },

  F(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R);
    const ring = attachRing(M, 'CG', 'CB', 6,
      ['CD1', 'CE1', 'CZ', 'CE2', 'CD2'], R);
    M.dbl('CG', 'CD1', ring.c)
     .dbl('CE1', 'CZ', ring.c)
     .dbl('CE2', 'CD2', ring.c);
  },

  Y(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R);
    const ring = attachRing(M, 'CG', 'CB', 6,
      ['CD1', 'CE1', 'CZ', 'CE2', 'CD2'], R);
    M.dbl('CG', 'CD1', ring.c)
     .dbl('CE1', 'CZ', ring.c)
     .dbl('CE2', 'CD2', ring.c);

    /* para hydroxyl: straight out from the ring centre through CZ */
    const CZ = M.get('CZ');
    let vx = CZ.x - ring.c[0], vy = CZ.y - ring.c[1];
    const L = Math.hypot(vx, vy); vx /= L; vy /= L;
    M.put('OH', CZ.x + vx, CZ.y + vy, { ...RO, text: 'OH' });
    M.bond('CZ', 'OH');
  },

  W(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R);
    /* pyrrole half of the indole */
    const five = attachRing(M, 'CG', 'CB', 5,
      ['CD1', 'NE1', 'CE2', 'CD2'], R);
    M.get('NE1').el = 'N';
    M.get('NE1').text = 'NH';
    M.dbl('CG', 'CD1', five.c);
    /* benzo half, fused on C7a–C3a */
    const six = fuseRing(M, 'CE2', 'CD2', 6,
      ['CE3', 'CZ3', 'CH2', 'CZ2'], five.c, R);
    M.dbl('CD2', 'CE3', six.c)
     .dbl('CZ3', 'CH2', six.c)
     .dbl('CZ2', 'CE2', six.c);
  },

  S(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'OG', { ...RO, text: 'OH', anchor: 'end' });
  },

  T(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'OG1', { ...RO, text: 'OH', anchor: 'end' })
     .go('CB', 'dr', 'CG2', R);
  },

  C(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'SG', { ...RS, text: 'SH', anchor: 'end' });
  },

  N(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R)
     .go('CG', 'ul', 'OD1', { ...RO, text: 'O', order: 2 })
     .go('CG', 'd', 'ND2', { ...RN, text: 'NH₂' });
  },

  Q(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R)
     .go('CG', 'd', 'CD', R)
     .go('CD', 'dl', 'OE1', { ...RO, text: 'O', order: 2 })
     .go('CD', 'dr', 'NE2', { ...RN, text: 'NH₂', anchor: 'start' });
  },

  D(M, iso) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R)
     .go('CG', 'ul', 'OD1', { ...RO, text: 'O', order: 2 })
     .go('CG', 'd', 'OD2', { ...RO, text: iso ? 'O⁻' : 'OH' });
  },

  E(M, iso) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R)
     .go('CG', 'd', 'CD', R)
     .go('CD', 'dl', 'OE1', { ...RO, text: 'O', order: 2 })
     .go('CD', 'dr', 'OE2', { ...RO, text: iso ? 'O⁻' : 'OH', anchor: 'start' });
  },

  K(M, iso) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R)
     .go('CG', 'd', 'CD', R)
     .go('CD', 'dl', 'CE', R)
     .go('CE', 'd', 'NZ', { ...RN, text: iso ? 'NH₃⁺' : 'NH₂' });
  },

  R(M, iso) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R)
     .go('CG', 'd', 'CD', R)
     .go('CD', 'dl', 'NE', { ...RN, text: 'NH', anchor: 'end' })
     .go('NE', 'd', 'CZ', R)
     .go('CZ', 'dl', 'NH1', { ...RN, text: iso ? 'NH₂⁺' : 'NH', order: 2 })
     .go('CZ', 'dr', 'NH2', { ...RN, text: 'NH₂', anchor: 'start' });
  },

  H(M) {
    M.go('CA', 'd', 'CB', R)
     .go('CB', 'dl', 'CG', R);
    const ring = attachRing(M, 'CG', 'CB', 5,
      ['ND1', 'CE1', 'NE2', 'CD2'], R);
    const nd1 = M.get('ND1'), ne2 = M.get('NE2');
    nd1.el = 'N'; nd1.text = 'N';
    ne2.el = 'N'; ne2.text = 'NH';
    M.dbl('ND1', 'CE1', ring.c)
     .dbl('CD2', 'CG', ring.c);
  }
};

function buildAA(code, iso) {
  const M = Mol();
  backbone(M, iso);
  SIDECHAIN[code](M, iso);
  return M;
}

/* ------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------ */

const CHAR_HALF = 0.115;   // half-width of one character, in bond units
const LINE_HALF = 0.30;    // half-height of a text label

/* how far the label sticks out from the atom position, per side */
function extent(at) {
  if (!at.text) return { l: 0.05, r: 0.05, u: 0.05, d: 0.05 };
  const full = 2 * (CHAR_HALF * at.text.length + 0.05);
  if (at.anchor === 'end') {
    return { l: full - CHAR_HALF, r: CHAR_HALF, u: LINE_HALF, d: LINE_HALF };
  }
  if (at.anchor === 'start') {
    return { l: CHAR_HALF, r: full - CHAR_HALF, u: LINE_HALF, d: LINE_HALF };
  }
  return { l: full / 2, r: full / 2, u: LINE_HALF, d: LINE_HALF };
}

/* distance from the atom centre to the edge of its label, along (dx,dy) */
function trim(at, dx, dy) {
  if (!at.text) return 0;
  const ax = at.anchor === 'middle'
    ? CHAR_HALF * at.text.length + 0.09
    : 0.27;
  const ay = 0.33;
  return 1 / Math.hypot(dx / ax, dy / ay);
}

function textX(at) {
  if (at.anchor === 'end') return at.x + CHAR_HALF;
  if (at.anchor === 'start') return at.x - CHAR_HALF;
  return at.x;
}


/* Returns an <svg> string.
   opts: { form: 'neutral'|'ion', label: accessible name (defaults to the
   residue's name; a quiz passes something that does not give it away) } */
function moleculeSVG(code, opts = {}) {
  const iso = opts.form === 'ion';
  const M = buildAA(code, iso);
  const pad = opts.pad != null ? opts.pad : 0.45;

  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const at of M.list) {
    const e = extent(at);
    minx = Math.min(minx, at.x - e.l); maxx = Math.max(maxx, at.x + e.r);
    miny = Math.min(miny, at.y - e.u); maxy = Math.max(maxy, at.y + e.d);
  }
  minx -= pad; maxx += pad; miny -= pad; maxy += pad;

  const parts = [];

  for (const bd of M.bonds) {
    const A = M.get(bd.a), B = M.get(bd.b);
    let dx = B.x - A.x, dy = B.y - A.y;
    const len = Math.hypot(dx, dy); dx /= len; dy /= len;

    const tA = trim(A, dx, dy);
    const tB = trim(B, dx, dy);
    const x1 = A.x + dx * tA, y1 = A.y + dy * tA;
    const x2 = B.x - dx * tB, y2 = B.y - dy * tB;
    const cls = bd.side ? 'sc' : 'bb';

    if (bd.order === 2) {
      const px = -dy, py = dx;
      if (bd.inner) {
        /* ring double bond: full outer line plus a shortened inner one */
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        const s = ((bd.inner[0] - mx) * px + (bd.inner[1] - my) * py) >= 0 ? 1 : -1;
        const o = 0.16 * s;
        const k = 0.16;
        parts.push(svgLine(x1, y1, x2, y2, cls));
        parts.push(svgLine(
          x1 + px * o + dx * k, y1 + py * o + dy * k,
          x2 + px * o - dx * k, y2 + py * o - dy * k, cls));
      } else {
        const o = 0.085;
        parts.push(svgLine(x1 + px * o, y1 + py * o, x2 + px * o, y2 + py * o, cls));
        parts.push(svgLine(x1 - px * o, y1 - py * o, x2 - px * o, y2 - py * o, cls));
      }
    } else {
      parts.push(svgLine(x1, y1, x2, y2, cls));
    }
  }

  for (const at of M.list) {
    if (!at.text) continue;
    const cls = (at.side ? 'sc' : 'bb') + ' el-' + at.el;
    parts.push(
      `<text x="${fmt(textX(at))}" y="${fmt(at.y)}" text-anchor="${at.anchor}" ` +
      `class="${cls}">${esc(at.text)}</text>`);
  }

  const w = maxx - minx, h = maxy - miny;
  const label = opts.label || `Skeletal structure of ${aa(code).name}`;
  return `<svg class="mol" viewBox="${fmt(minx)} ${fmt(miny)} ${fmt(w)} ${fmt(h)}" ` +
         `preserveAspectRatio="xMidYMid meet" role="img" ` +
         `aria-label="${esc(label)}">${parts.join('')}</svg>`;
}

function svgLine(x1, y1, x2, y2, cls) {
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" class="${cls}"/>`;
}

function fmt(n) { return Math.round(n * 1000) / 1000; }
