/* ------------------------------------------------------------------
   build.js — bundles the site into ONE self-contained .html file.

     node build.js          write offline/amino-acid-trainer.html
     node build.js --check   exit 1 if that file is stale (no write)

   The website itself is index.html + css/ + js/, served as-is. The
   bundle is the download for studying without a connection: the CSS
   and all three scripts inlined, so it works from a USB stick or an
   email attachment with no folder beside it.
   ------------------------------------------------------------------ */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'offline');
const OUT = path.join(OUT_DIR, 'amino-acid-trainer.html');
const CHECK = process.argv.includes('--check');

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* A literal </script> inside inlined JS would close the tag early.
   Nothing in this project has one, but escape defensively so the
   bundle can never be silently corrupted by a future edit. */
const safe = js => js.replace(/<\/script/gi, '<\\/script');

let html = read('index.html');

// 1. inline the stylesheet
const cssTag = /<link rel="stylesheet" href="css\/styles\.css">/;
if (!cssTag.test(html)) throw new Error('stylesheet <link> not found in index.html');
html = html.replace(cssTag, '<style>\n' + read('css/styles.css').trim() + '\n</style>');

// 2. inline the scripts, in their original order
for (const file of ['js/data.js', 'js/chem.js', 'js/app.js']) {
  const tag = new RegExp('<script src="' + file.replace(/[.\/]/g, '\\$&') + '"><\\/script>');
  if (!tag.test(html)) throw new Error('<script> tag not found for ' + file);
  html = html.replace(tag, '<script>\n' + safe(read(file).trim()) + '\n</script>');
}

/* 3. Nothing local may still be referenced. Absolute http(s)/mailto
   links are outbound navigation the visitor clicks, not subresources
   the file needs in order to load, so those are fine. */
const allRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
const unbundled = allRefs.filter(u => !/^(data:|#|https?:\/\/|mailto:)/i.test(u));
if (unbundled.length) {
  throw new Error('local asset was not inlined: ' + unbundled.join(', '));
}
const outbound = allRefs.filter(u => /^https?:\/\//i.test(u));

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (current !== html) {
    console.error('STALE: offline/amino-acid-trainer.html does not match the source.\n' +
                  'Run `node build.js` and commit the result.');
    process.exit(1);
  }
  console.log('offline bundle is up to date');
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('wrote ' + path.relative(ROOT, OUT).replace(/\\/g, '/') +
            '  (' + kb + ' KB, single file, no dependencies)');
if (outbound.length) {
  console.log('outbound links (clicked by the visitor, not needed to load): ' +
    outbound.join(', '));
}
