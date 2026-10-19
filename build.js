/* ------------------------------------------------------------------
   build.js — bundles the site into ONE self-contained .html file.

     node build.js          write offline/amino-acid-trainer.html
     node build.js --check   exit 1 if that file is stale (no write)

   The website itself is index.html + css/ + js/ + fonts/, served as-is.
   The bundle is the download for studying without a connection: the
   stylesheet, the font (as a data URI) and all four scripts inlined, so
   it works from a USB stick or an email attachment with nothing beside it.
   ------------------------------------------------------------------ */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'offline');
const OUT = path.join(OUT_DIR, 'amino-acid-trainer.html');
const CHECK = process.argv.includes('--check');

const SCRIPTS = ['js/data.js', 'js/chem.js', 'js/sky.js', 'js/app.js'];
const FONT = 'fonts/nunito-latin-wght-normal.woff2';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* A literal </script> inside inlined JS would close the tag early. */
const safe = js => js.replace(/<\/script/gi, '<\\/script');

let html = read('index.html');

/* Analytics only makes sense when the page can phone home. The offline
   bundle is explicitly for studying with no connection, so drop it. */
html = html.replace(/\s*<!-- analytics:start[\s\S]*?analytics:end -->\n?/, '\n');

/* The font preload points at a file the bundle will not have beside it. */
html = html.replace(/\s*<link rel="preload" href="fonts\/[^"]+"[^>]*>\n?/, '\n');

// 1. inline the stylesheet, with the font embedded as a data URI
const cssTag = /<link rel="stylesheet" href="css\/styles\.css">/;
if (!cssTag.test(html)) throw new Error('stylesheet <link> not found in index.html');
const fontB64 = fs.readFileSync(path.join(ROOT, FONT)).toString('base64');
let css = read('css/styles.css').trim();
const fontRef = /url\('\.\.\/fonts\/nunito-latin-wght-normal\.woff2'\)/;
if (!fontRef.test(css)) throw new Error('font url() not found in styles.css');
css = css.replace(fontRef, `url('data:font/woff2;base64,${fontB64}')`);
html = html.replace(cssTag, '<style>\n' + css + '\n</style>');

// 2. inline the scripts, in their original order
for (const file of SCRIPTS) {
  const tag = new RegExp('<script src="' + file.replace(/[.\/]/g, '\\$&') + '"><\\/script>');
  if (!tag.test(html)) throw new Error('<script> tag not found for ' + file);
  html = html.replace(tag, '<script>\n' + safe(read(file).trim()) + '\n</script>');
}

/* 3. Nothing local may still be referenced. Absolute http(s)/mailto
   links are outbound navigation the visitor clicks, not subresources
   the file needs in order to load, so those are fine. */
const allRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
const unbundled = allRefs.filter(u => !/^(data:|#|https?:\/\/|mailto:)/i.test(u));
if (unbundled.length) throw new Error('local asset was not inlined: ' + unbundled.join(', '));
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
  console.log('outbound links (clicked by the visitor, not needed to load): ' + outbound.join(', '));
}
