const fs = require('fs');

function extractDict(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const dict = {};
  // match 'key': 'value' or "key": "value" or 'key': `value`
  const re = /['"]([^'"]+)['"]\s*:\s*(['"`](?:[\s\S]*?)['"`])\s*[,}]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    dict[m[1]] = m[2];
  }
  return dict;
}

const enDict = extractDict('src/i18n/translations/en.ts');
const hiDict = extractDict('src/i18n/translations/hi.ts');
const taDict = extractDict('src/i18n/translations/ta.ts');

const missingHi = Object.keys(enDict).filter(k => !hiDict[k]);
console.log('Total keys in en:', Object.keys(enDict).length);
console.log('Total keys in ta:', Object.keys(taDict).length);
console.log('Total keys in hi:', Object.keys(hiDict).length);
console.log('Missing in hi:', missingHi.length);

const missingData = missingHi.map(k => ({
  key: k,
  en: enDict[k],
  ta: taDict[k] || ''
}));

fs.writeFileSync('scripts/missing-keys.json', JSON.stringify(missingData, null, 2));
console.log('Wrote scripts/missing-keys.json with length:', missingData.length);
