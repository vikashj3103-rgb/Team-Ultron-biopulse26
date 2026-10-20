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

const enDict = parseTsDict('src/i18n/translations/en.ts');
const taDict = parseTsDict('src/i18n/translations/ta.ts');
const hiBase = parseTsDict('src/i18n/translations/hi.ts');
const { hiTranslations } = require('./translations-hi-te.cjs');

const finalHi = { ...hiBase, ...hiTranslations };
const remainingKeys = Object.keys(enDict).filter(k => !finalHi[k]);

console.log('Remaining keys count:', remainingKeys.length);
const remainingList = remainingKeys.map(k => ({
  key: k,
  en: enDict[k],
  ta: taDict[k] || ''
}));

fs.writeFileSync('scripts/remaining-219.json', JSON.stringify(remainingList, null, 2));
console.log('Saved to scripts/remaining-219.json');
