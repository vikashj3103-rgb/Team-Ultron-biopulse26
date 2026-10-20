const fs = require('fs');

function parseTsDict(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const dict = {};
  const re = /['"]([^'"]+)['"]\s*:\s*(['"`](?:[\s\S]*?)['"`])\s*[,}]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    let val = m[2];
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"')) || (val.startsWith('`') && val.endsWith('`'))) {
      val = val.slice(1, -1);
    }
    dict[m[1]] = val;
  }
  return dict;
}

const langs = ['en', 'ta', 'hi', 'te'];
const dicts = {};

for (const lang of langs) {
  const p = `src/i18n/translations/${lang}.ts`;
  if (!fs.existsSync(p)) {
    console.error(`FAIL: Translation file ${p} does not exist!`);
    process.exit(1);
  }
  dicts[lang] = parseTsDict(p);
  console.log(`PASS: ${lang}.ts loaded with ${Object.keys(dicts[lang]).length} keys.`);
}

const enKeys = new Set(Object.keys(dicts.en));
let allPassed = true;

for (const lang of ['ta', 'hi', 'te']) {
  const langKeys = new Set(Object.keys(dicts[lang]));
  const missing = [...enKeys].filter(k => !langKeys.has(k));
  const extra = [...langKeys].filter(k => !enKeys.has(k));
  const empty = Object.entries(dicts[lang]).filter(([k, v]) => !v || v.trim().length === 0).map(([k]) => k);

  if (missing.length > 0) {
    console.error(`FAIL: ${lang} is missing ${missing.length} keys:`, missing.slice(0, 10));
    allPassed = false;
  } else {
    console.log(`PASS: ${lang} has 0 missing keys.`);
  }

  if (extra.length > 0) {
    console.error(`FAIL: ${lang} has ${extra.length} extra keys:`, extra.slice(0, 10));
    allPassed = false;
  } else {
    console.log(`PASS: ${lang} has 0 extra keys.`);
  }

  if (empty.length > 0) {
    console.error(`FAIL: ${lang} has ${empty.length} empty values:`, empty.slice(0, 10));
    allPassed = false;
  } else {
    console.log(`PASS: ${lang} has 0 empty values.`);
  }
}

if (!allPassed) {
  console.error('\n❌ i18n parity check FAILED.');
  process.exit(1);
} else {
  console.log(`\n✅ 100% i18n parity confirmed across all 4 languages (${enKeys.size} keys each).`);
  process.exit(0);
}
