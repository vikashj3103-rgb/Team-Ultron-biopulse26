// Comprehensive translation map generator for HealthConnect i18n
const fs = require('fs');

// We will load en.ts and ta.ts dictionaries
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
const teBase = parseTsDict('src/i18n/translations/te.ts');

console.log('Loaded en keys:', Object.keys(enDict).length);
console.log('Loaded ta keys:', Object.keys(taDict).length);
console.log('Loaded hi base keys:', Object.keys(hiBase).length);
console.log('Loaded te base keys:', Object.keys(teBase).length);
