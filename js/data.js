/* ------------------------------------------------------------------
   data.js — the 20 standard proteinogenic amino acids.
   Values follow Lehninger, Principles of Biochemistry (pKa, pI, MW)
   and Kyte–Doolittle for hydropathy.
   ------------------------------------------------------------------ */

const CLASSES = {
  aliphatic: {
    id: 'aliphatic',
    label: 'Nonpolar, aliphatic',
    short: 'Nonpolar',
    cat: 7,
    blurb: 'Greasy hydrocarbon side chains. Cluster in the protein core, driven together by the hydrophobic effect.'
  },
  aromatic: {
    id: 'aromatic',
    label: 'Aromatic',
    short: 'Aromatic',
    cat: 5,
    blurb: 'Bulky ring side chains. Largely hydrophobic; responsible for protein absorbance at 280 nm (Trp ≫ Tyr > Phe).'
  },
  polar: {
    id: 'polar',
    label: 'Polar, uncharged',
    short: 'Polar',
    cat: 3,
    blurb: 'Neutral at pH 7 but hydrogen-bonding. Usually found on the solvent-exposed surface.'
  },
  acidic: {
    id: 'acidic',
    label: 'Negatively charged (acidic)',
    short: 'Acidic',
    cat: 8,
    blurb: 'Carboxylate side chains, fully deprotonated and −1 at pH 7.'
  },
  basic: {
    id: 'basic',
    label: 'Positively charged (basic)',
    short: 'Basic',
    cat: 4,
    blurb: 'Protonated and positive at pH 7 (His only partially — its pKa sits right at physiological pH).'
  }
};

/* cat: which --sd-cat-N token stands for the class. It is always shown
   beside the class name or the residue's letter, never on its own. */
const CLASS_ORDER = ['aliphatic', 'aromatic', 'polar', 'acidic', 'basic'];

/* essential: true | false | 'conditional'
   charge7:   net charge on the SIDE CHAIN at pH 7.0
   pKaR:      side-chain pKa (null if not ionizable)
   hydropathy: Kyte–Doolittle index (+ = hydrophobic)                */

const AAS = [
  {
    code: 'G', three: 'Gly', name: 'Glycine', alt: [],
    cls: 'aliphatic', charge7: 0,
    pKaR: null, pI: 5.97, mw: 75.07, essential: false, hydropathy: -0.4,
    group: 'Hydrogen (no side chain)', groupKey: 'none',
    codons: ['GGU', 'GGC', 'GGA', 'GGG'],
    mnemonic: 'G for Glycine — the only achiral one, side chain is just an H.',
    note: 'Smallest amino acid. Its tiny side chain gives the backbone unusual conformational freedom, so it shows up at tight turns and in collagen every third residue.'
  },
  {
    code: 'A', three: 'Ala', name: 'Alanine', alt: [],
    cls: 'aliphatic', charge7: 0,
    pKaR: null, pI: 6.01, mw: 89.09, essential: false, hydropathy: 1.8,
    group: 'Methyl', groupKey: 'alkyl',
    codons: ['GCU', 'GCC', 'GCA', 'GCG'],
    mnemonic: 'A for Alanine — the simplest carbon side chain, one CH₃.',
    note: 'The reference "average" residue. Strong α-helix former.'
  },
  {
    code: 'V', three: 'Val', name: 'Valine', alt: [],
    cls: 'aliphatic', charge7: 0,
    pKaR: null, pI: 5.97, mw: 117.15, essential: true, hydropathy: 4.2,
    group: 'Isopropyl (branched alkyl)', groupKey: 'alkyl',
    codons: ['GUU', 'GUC', 'GUA', 'GUG'],
    mnemonic: 'V for Valine — the V-shaped fork of two methyls on Cβ.',
    note: 'Branched at the β-carbon, which crowds the backbone and favors β-sheets over helices. Glu→Val at position 6 of β-globin causes sickle-cell disease.'
  },
  {
    code: 'L', three: 'Leu', name: 'Leucine', alt: [],
    cls: 'aliphatic', charge7: 0,
    pKaR: null, pI: 5.98, mw: 131.17, essential: true, hydropathy: 3.8,
    group: 'Isobutyl (branched alkyl)', groupKey: 'alkyl',
    codons: ['UUA', 'UUG', 'CUU', 'CUC', 'CUA', 'CUG'],
    mnemonic: 'Leucine vs Isoleucine: Leu branches LATE (at Cγ), Ile branches EARLY (at Cβ).',
    note: 'The most abundant residue in most proteomes, and the core of the "leucine zipper" dimerization motif.'
  },
  {
    code: 'I', three: 'Ile', name: 'Isoleucine', alt: [],
    cls: 'aliphatic', charge7: 0,
    pKaR: null, pI: 6.02, mw: 131.17, essential: true, hydropathy: 4.5,
    group: 'sec-Butyl (branched alkyl)', groupKey: 'alkyl',
    codons: ['AUU', 'AUC', 'AUA'],
    mnemonic: 'I for Isoleucine — branches at Cβ, so it has a second chiral center.',
    note: 'Strongly hydrophobic, and isomeric with Leu — same formula, different branch point.'
  },
  {
    code: 'P', three: 'Pro', name: 'Proline', alt: [],
    cls: 'aliphatic', charge7: 0,
    pKaR: null, pI: 6.48, mw: 115.13, essential: false, hydropathy: -1.6,
    group: 'Pyrrolidine ring (secondary amine)', groupKey: 'ring-n',
    codons: ['CCU', 'CCC', 'CCA', 'CCG'],
    mnemonic: 'P for Proline — the Prison: its side chain loops back and locks the nitrogen in a ring.',
    note: 'The only secondary amine ("imino acid"). The ring fixes the backbone angle and removes the amide N–H, so Pro breaks α-helices and β-sheets and is a helix-capping / turn residue.'
  },
  {
    code: 'M', three: 'Met', name: 'Methionine', alt: [],
    cls: 'aliphatic', charge7: 0,
    pKaR: null, pI: 5.74, mw: 149.21, essential: true, hydropathy: 1.9,
    group: 'Thioether (S–CH₃)', groupKey: 'sulfur',
    codons: ['AUG'],
    mnemonic: 'M for Met — the START. AUG is the only codon, and it is the initiator residue.',
    note: 'One of two sulfur-containing amino acids, but its thioether will not form disulfides. Precursor of SAM, the cell\'s universal methyl donor.'
  },
  {
    code: 'F', three: 'Phe', name: 'Phenylalanine', alt: [],
    cls: 'aromatic', charge7: 0,
    pKaR: null, pI: 5.48, mw: 165.19, essential: true, hydropathy: 2.8,
    group: 'Phenyl (benzene ring)', groupKey: 'aromatic',
    codons: ['UUU', 'UUC'],
    mnemonic: 'F = "Fenylalanine" — spell it with an F and the one-letter code is obvious.',
    note: 'Alanine with a benzene ring bolted on. Strongly hydrophobic. Builds up toxically in phenylketonuria (PKU).'
  },
  {
    code: 'Y', three: 'Tyr', name: 'Tyrosine', alt: [],
    cls: 'aromatic', charge7: 0,
    pKaR: 10.07, pI: 5.66, mw: 181.19, essential: false, hydropathy: -1.3,
    group: 'Phenol (aromatic –OH)', groupKey: 'hydroxyl',
    codons: ['UAU', 'UAC'],
    mnemonic: 'tYrosine — the Y is right there in the name; the letter Y even looks like the phenol\'s –OH stub.',
    note: 'Phe plus a para hydroxyl, which makes it polar and weakly acidic (pKa ≈ 10.1). A major phosphorylation site in signaling; precursor of dopamine, adrenaline, melanin and thyroid hormone.'
  },
  {
    code: 'W', three: 'Trp', name: 'Tryptophan', alt: [],
    cls: 'aromatic', charge7: 0,
    pKaR: null, pI: 5.89, mw: 204.23, essential: true, hydropathy: -0.9,
    group: 'Indole (bicyclic)', groupKey: 'aromatic',
    codons: ['UGG'],
    mnemonic: 'W = "double-u" = the double ring. Also the biggest letter for the biggest residue.',
    note: 'Largest and heaviest amino acid (204 Da). Its indole dominates protein absorbance at 280 nm. Precursor of serotonin, melatonin and niacin.'
  },
  {
    code: 'S', three: 'Ser', name: 'Serine', alt: [],
    cls: 'polar', charge7: 0,
    pKaR: null, pI: 5.68, mw: 105.09, essential: false, hydropathy: -0.8,
    group: 'Hydroxyl (primary alcohol)', groupKey: 'hydroxyl',
    codons: ['UCU', 'UCC', 'UCA', 'UCG', 'AGU', 'AGC'],
    mnemonic: 'S for Serine — Small, with a Simple –OH. (Ser = Ala + OH.)',
    note: 'A phosphorylation target and the nucleophile in serine proteases (chymotrypsin, trypsin) via the catalytic triad.'
  },
  {
    code: 'T', three: 'Thr', name: 'Threonine', alt: [],
    cls: 'polar', charge7: 0,
    pKaR: null, pI: 5.87, mw: 119.12, essential: true, hydropathy: -0.7,
    group: 'Hydroxyl (secondary alcohol)', groupKey: 'hydroxyl',
    codons: ['ACU', 'ACC', 'ACA', 'ACG'],
    mnemonic: 'T for Threonine — Ser with an extra methyl, so it is the branched (β-carbon) alcohol.',
    note: 'Like Ile, branched at Cβ with two chiral centers. Also a phosphorylation site and an O-glycosylation anchor.'
  },
  {
    code: 'C', three: 'Cys', name: 'Cysteine', alt: [],
    cls: 'polar', charge7: 0,
    pKaR: 8.18, pI: 5.07, mw: 121.16, essential: false, hydropathy: 2.5,
    group: 'Thiol / sulfhydryl (–SH)', groupKey: 'sulfur',
    codons: ['UGU', 'UGC'],
    mnemonic: 'C for Cysteine — and C for the Cross-links (disulfide bridges) it forms.',
    note: 'Serine with S in place of O. Two cysteines oxidize to a disulfide bond (cystine), the main covalent cross-link stabilizing secreted proteins. Often listed as "special" rather than plainly polar.'
  },
  {
    code: 'N', three: 'Asn', name: 'Asparagine', alt: [],
    cls: 'polar', charge7: 0,
    pKaR: null, pI: 5.41, mw: 132.12, essential: false, hydropathy: -3.5,
    group: 'Amide (carboxamide)', groupKey: 'amide',
    codons: ['AAU', 'AAC'],
    mnemonic: 'AsparagiNe → N. It is the amide of Aspartate: swap the –OH for –NH₂.',
    note: 'Amide of Asp — neutral, never charged. A common site for N-linked glycosylation.'
  },
  {
    code: 'Q', three: 'Gln', name: 'Glutamine', alt: [],
    cls: 'polar', charge7: 0,
    pKaR: null, pI: 5.65, mw: 146.15, essential: false, hydropathy: -3.5,
    group: 'Amide (carboxamide)', groupKey: 'amide',
    codons: ['CAA', 'CAG'],
    mnemonic: 'Q-tamine — "Gln" sounds like Q, and Q is the leftover letter next to N.',
    note: 'Amide of Glu, one carbon longer than Asn. The main nitrogen shuttle in blood and the most abundant free amino acid in the body.'
  },
  {
    code: 'D', three: 'Asp', name: 'Aspartate', alt: ['Aspartic acid'],
    cls: 'acidic', charge7: -1,
    pKaR: 3.65, pI: 2.77, mw: 133.10, essential: false, hydropathy: -3.5,
    group: 'Carboxyl / carboxylate (–COO⁻)', groupKey: 'carboxyl',
    codons: ['GAU', 'GAC'],
    mnemonic: 'AsparDic acid → D. D is the shorter acid; E is D plus one CH₂.',
    note: 'Negative at pH 7 (side-chain pKa ≈ 3.9). Frequent metal-binding and catalytic residue; part of the catalytic triad in serine proteases.'
  },
  {
    code: 'E', three: 'Glu', name: 'Glutamate', alt: ['Glutamic acid'],
    cls: 'acidic', charge7: -1,
    pKaR: 4.25, pI: 3.22, mw: 147.13, essential: false, hydropathy: -3.5,
    group: 'Carboxyl / carboxylate (–COO⁻)', groupKey: 'carboxyl',
    codons: ['GAA', 'GAG'],
    mnemonic: 'GlutamatE → E. Think "E is longEr than D" by exactly one CH₂.',
    note: 'The principal excitatory neurotransmitter in the CNS, and the flavor behind MSG.'
  },
  {
    code: 'K', three: 'Lys', name: 'Lysine', alt: [],
    cls: 'basic', charge7: 1,
    pKaR: 10.53, pI: 9.74, mw: 146.19, essential: true, hydropathy: -3.9,
    group: 'Primary amine / ammonium (–NH₃⁺)', groupKey: 'amine',
    codons: ['AAA', 'AAG'],
    mnemonic: 'Lysine takes K because L was already claimed by Leucine — K is the nearest free letter.',
    note: 'Long flexible arm ending in –NH₃⁺; positive at pH 7. Prime target for acetylation and methylation in histone regulation.'
  },
  {
    code: 'R', three: 'Arg', name: 'Arginine', alt: [],
    cls: 'basic', charge7: 1,
    pKaR: 12.48, pI: 10.76, mw: 174.20, essential: 'conditional', hydropathy: -4.5,
    group: 'Guanidinium', groupKey: 'guanidinium',
    codons: ['CGU', 'CGC', 'CGA', 'CGG', 'AGA', 'AGG'],
    mnemonic: 'aRginine → R. Most basic of all (pKa ≈ 12.5), so it is essentially always positive.',
    note: 'Its guanidinium group spreads the + charge over three nitrogens, making it the strongest base and strongly hydrophilic. Precursor of nitric oxide.'
  },
  {
    /* charge7 is 0, not +1: the imidazole pKa (6.0) sits BELOW pH 7, so
       at pH 7 the side chain is predominantly deprotonated (~9% still
       protonated by Henderson–Hasselbalch). His is still classed as
       basic — that is about the group's chemistry, not its state here. */
    code: 'H', three: 'His', name: 'Histidine', alt: [],
    cls: 'basic', charge7: 0,
    pKaR: 6.00, pI: 7.59, mw: 155.15, essential: true, hydropathy: -3.2,
    group: 'Imidazole', groupKey: 'ring-n',
    codons: ['CAU', 'CAC'],
    mnemonic: 'H for His — and H for the H⁺ it hands back and forth. The only side chain that buffers near pH 7.',
    note: 'Side-chain pKa ≈ 6.0, so it sits right at physiological pH and is only partly protonated — which is exactly why it is the workhorse acid/base catalyst and the classic metal-coordinating residue (e.g. heme iron).'
  }
];

/* Lookup helpers -------------------------------------------------- */
const BY_CODE = Object.fromEntries(AAS.map(a => [a.code, a]));
const ALL_CODES = AAS.map(a => a.code);

function aa(code) { return BY_CODE[code]; }

/* HTML-escape for anything that reaches innerHTML. data.js loads first,
   so chem.js and app.js share this one. */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Accepted spellings when the player types a full name */
function nameMatches(input, a) {
  const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
  const target = [a.name, ...a.alt].map(norm);
  return target.includes(norm(input));
}

/* Charge label used across quizzes and cards */
function chargeLabel(a) {
  if (a.charge7 > 0) return '+1';
  if (a.charge7 < 0) return '−1';
  return '0 (neutral)';
}

/* Shown on the reference card and the post-answer panel, but never quizzed. */
function essentialLabel(a) {
  if (a.essential === true) return 'Essential';
  if (a.essential === 'conditional') return 'Conditionally essential';
  return 'Non-essential';
}

/* ------------------------------------------------------------------
   Ionisation: backbone pKa values (Lehninger Table 3-1).
   [pK1, pK2] = α-carboxyl, α-amino. Together with pKaR above these
   reproduce every pI in this file exactly — see computePI().
   ------------------------------------------------------------------ */
const BACKBONE_PKA = {
  G: [2.34, 9.60],  A: [2.34, 9.69],  V: [2.32, 9.62],  L: [2.36, 9.60],
  I: [2.36, 9.68],  P: [1.99, 10.96], M: [2.28, 9.21],  F: [1.83, 9.13],
  Y: [2.20, 9.11],  W: [2.38, 9.39],  S: [2.21, 9.15],  T: [2.11, 9.62],
  C: [1.96, 10.28], N: [2.02, 8.80],  Q: [2.17, 9.13],  D: [1.88, 9.60],
  E: [2.19, 9.67],  K: [2.18, 8.95],  R: [2.17, 9.04],  H: [1.82, 9.17]
};

/* Side chains that LOSE a proton to become negative, vs those that
   HOLD one to stay positive. Cys (thiol) and Tyr (phenol) are acids
   even though neither is in the "acidic" class.
   pKaLadder() below branches on R_BASIC; R_ACIDIC is the stated
   complement, and verify.js checks the two agree. */
const R_ACIDIC = ['D', 'E', 'C', 'Y'];
const R_BASIC  = ['K', 'R', 'H'];

/* Every ionisable group, low pKa to high. `from`/`to` are the charge
   contributions below and above that group's pKa. */
function pKaLadder(code) {
  const a = BY_CODE[code];
  const [pK1, pK2] = BACKBONE_PKA[code];
  const rungs = [
    { pKa: pK1, from: 0, to: -1, group: 'α-carboxyl' },
    { pKa: pK2, from: 1, to: 0, group: 'α-amino' }
  ];
  if (a.pKaR) {
    rungs.push(R_BASIC.includes(code)
      ? { pKa: a.pKaR, from: 1, to: 0, group: 'side chain' }
      : { pKa: a.pKaR, from: 0, to: -1, group: 'side chain' });
  }
  return rungs.sort((x, y) => x.pKa - y.pKa);
}

/* Net charge on the whole amino acid at a given pH. A group is
   deprotonated once pH climbs past its pKa. */
function netChargeAt(code, pH) {
  return pKaLadder(code)
    .reduce((sum, g) => sum + (pH > g.pKa ? g.to : g.from), 0);
}

/* pI is the midpoint of the two pKa values that bracket the species
   carrying no net charge. */
function computePI(code) {
  const L = pKaLadder(code);
  let charge = L.reduce((s, g) => s + g.from, 0);   // fully protonated
  for (let i = 0; i < L.length; i++) {
    charge += L[i].to - L[i].from;                  // deprotonate group i
    if (charge === 0 && i + 1 < L.length) {
      return { pI: (L[i].pKa + L[i + 1].pKa) / 2, pair: [L[i], L[i + 1]] };
    }
  }
  return null;
}

function chargeStr(n) {
  if (n > 0) return '+' + n;
  if (n < 0) return '−' + Math.abs(n);
  return '0';
}
