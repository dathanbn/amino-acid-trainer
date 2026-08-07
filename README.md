# Amino Acid Trainer

A free browser study game for the twenty standard amino acids. Tests structures,
abbreviations, side-chain classes, charge at any pH, and pI. Built for the
MCAT.

**Play it: https://dathanbn.github.io/amino-acid-trainer/**

Uses [GoatCounter](https://www.goatcounter.com/) for anonymous page-view
counts — no cookies, no personal data, no cross-site tracking, no consent
banner needed. Your quiz progress and study-set choices stay in your
browser's local storage and are never sent anywhere. See
[Analytics](#analytics) below.

---

## Modes

| Mode | What it drills |
|---|---|
| Structure → Name | Read a skeletal structure, name the residue |
| Name → Structure | Pick the right side chain out of four |
| Abbreviations | Type the one- and three-letter codes |
| Classify | Sort each residue into its side-chain class |
| Properties | Charge at pH 7, pKa, functional groups, biochemistry |
| Charge at pH | Net charge at any pH, with the working shown group by group |
| pKa & pI | Which two pKa values set the pI, and gel migration direction |
| Gauntlet | All of it, 90 seconds on the clock |
| Reference table | All twenty side by side with every property |

Rounds are 12 questions. Keys `1`–`5` pick an answer, `Enter` advances.

### MCAT yield slider

The Gauntlet card carries a three-stop slider that sets how deep *that mode*
goes. **It affects the Gauntlet only** — every other mode always covers its
full range, and nothing is ever greyed out or locked.

- **High yield** — only what turns up on nearly every exam. Charge questions
  stay at physiological pH; functional-group naming and gel migration sit out.
- **Exam scope** *(default)* — everything the AAMC actually tests.
- **Everything** — adds the rarely-examined long tail.

Measured on the Gauntlet: 122 / 210 / 213 distinct question shapes. The seven
standalone modes serve an identical 232 shapes at every slider position.

### Choosing what to study

Hover a letter in the mastery row for a card showing that residue's
structure, class, and your hit rate. **Click it** to drop it from every game
— useful once you have a handful nailed and want to drill only the ones that
still catch you out.

Skipped residues never appear again: not as a question, and not as a wrong
answer either. Multiple choice scales down to however many are left rather
than padding the options back out with residues you excluded, so studying
just Leu and Ile gives you two-choice questions. At least two must stay in
play, and "study all 20" puts everything back.

### Spaced repetition

Each residue carries a hidden score. Ones you have never seen, or recently got
wrong, come round far more often than ones you have answered correctly five
times running. The chips on the menu brighten as each residue is mastered, so
the gaps are visible at a glance. Progress lives in `localStorage` — it never
leaves your device, and clearing site data resets it.

---

## How the structures work

Nothing is a stored image. Every molecule is generated at render time from
bond vectors in [`js/chem.js`](js/chem.js): each bond is one unit long, every
angle is 108°, 120°, 126° or 132°, and rings are built by a fused-polygon
helper. The shared backbone is drawn in grey and the **side chain in blue**,
because the side chain is the only part that differs between the twenty — that
contrast is the point of the drawing.

The reference table toggles between the neutral form (–NH₂ / –COOH) and the
form at pH 7 (–NH₃⁺ / –COO⁻), since courses differ on which they expect.

## How charge and pI work

Both are *computed*, not hard-coded. `pKaLadder()` in
[`js/data.js`](js/data.js) orders every ionisable group — α-carboxyl, α-amino,
side chain — by pKa, and `computePI()` averages the two that bracket the
species with no net charge.

That derivation reproduces all twenty published pI values exactly, including
the ones students get wrong:

- **Cys** uses α-COOH + side chain, because the thiol pKa (8.18) falls below
  the α-amino (10.28).
- **Tyr** uses the two *backbone* values, because its phenol pKa (10.07) sits
  *above* the α-amino (9.11).
- **His** uses side chain + α-amino.

Histidine's side chain is scored **0** at pH 7, not +1: its pKa of 6.0 is below
7, so the imidazole is roughly 91% deprotonated there. It is still classed as
basic, which is about the group's chemistry rather than its state at one pH.

## MCAT scope

The quizzes are deliberately limited to AAMC content. Material that is useful
context but not tested — Kyte–Doolittle hydropathy, codons, molecular weight,
essential-vs-non-essential — appears on the reference table only, and is never
a question or an answer.

Hydropathy is the pointed omission. The Kyte–Doolittle sign disagrees with the
polar/nonpolar classification taught in Classify mode for Cys, Trp, Gly and
Pro, so ranking by it would have contradicted the rest of the app.

## Data sources

pKa, pI and M<sub>r</sub> follow Lehninger, *Principles of Biochemistry*
(Table 3-1). Hydropathy is the Kyte–Doolittle index. Classification uses
Lehninger's five groups. Arginine is marked conditionally essential; the other
nine essentials spell **PVT TIM HaLL**.

---

## Running and developing

Clone it and open `index.html`. There is no build step, no package manager and
no dependencies — plain HTML, CSS and three `<script>` tags.

```bash
node serve.js
```

Serves the folder on `http://localhost:8123` the way GitHub Pages will, over
HTTP rather than `file://`. Optional — the site works either way.

```bash
node verify.js
```

Runs the full correctness suite with no dependencies: molecular formulas
derived from the drawn bonds, atom valences, bond lengths and angles, label
collision detection in both pH forms, pI reproduction, 21 hand-worked charge
cases, and 27,000 generated questions across all three yield levels checked
for malformed output and out-of-scope content.

```bash
node build.js
```

Regenerates `offline/amino-acid-trainer.html` — a single self-contained file
with the CSS and all three scripts inlined, for studying without a connection.
Run this after any change to `css/` or `js/`; `verify.js` fails if it is stale.

### Files

```
index.html      page shell, meta tags
css/styles.css  styling
js/data.js      the twenty amino acids, pKa ladder, pI derivation
js/chem.js      structure builder and SVG renderer
js/app.js       screens, question generation, scoring, yield tiers
build.js        bundles the offline single-file copy
verify.js       correctness suite
serve.js        local preview server (development only)
.nojekyll       tells GitHub Pages to publish the files as-is
```

To change round length or the gauntlet clock, edit `ROUND_LEN` and
`GAUNTLET_SECONDS` at the top of `js/app.js`.

---

## Analytics

[GoatCounter](https://www.goatcounter.com/) counts page views so it's
possible to see how many people are using the site. That's all it does — no
cookies, no localStorage, no fingerprinting, no personal data, no ads, no
resale of data. Because it collects nothing identifying, no cookie-consent
banner is required.

The dashboard lives at `https://amino-acid-trainer.goatcounter.com` — log in there to
see visits, referrers (useful for seeing how much traffic came from a given
Reddit post), and rough browser/OS breakdowns.

The tracking script is deliberately **left out of the offline bundle**
(`offline/amino-acid-trainer.html`) — `build.js` strips it automatically —
since that file is meant for studying with no connection at all, and a
script that phones home has no place in it. `verify.js` checks this stays
true on every build.

---

## Hosting on GitHub Pages

1. Create a repository and push these files to it.
2. **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder
   `/ (root)`. Save.
3. Wait a minute, then load
   `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

`index.html` must stay at the repository root — that is what GitHub Pages
serves. The empty `.nojekyll` file tells Pages to publish the files as-is
rather than running them through Jekyll.

---

## Licence

[MIT](LICENSE). Use it, fork it, hand it to your study group.
