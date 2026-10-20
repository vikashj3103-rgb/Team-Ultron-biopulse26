const fs = require('fs');

function extractKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const keys = new Set();
  const re = /['"]([^'"]+)['"]\s*:/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

const enKeys = extractKeys('src/i18n/translations/en.ts');
const hiKeys = extractKeys('src/i18n/translations/hi.ts');
const teKeys = extractKeys('src/i18n/translations/te.ts');
const taKeys = extractKeys('src/i18n/translations/ta.ts');

const missingHi = [...enKeys].filter(k => !hiKeys.has(k));
const prefixes = {};
missingHi.forEach(k => {
  const p = k.split('.')[0];
  prefixes[p] = (prefixes[p] || 0) + 1;
});
console.log('Missing prefixes in HI:', prefixes);

const missingTe = [...enKeys].filter(k => !teKeys.has(k));
const tePrefixes = {};
missingTe.forEach(k => {
  const p = k.split('.')[0];
  tePrefixes[p] = (tePrefixes[p] || 0) + 1;
});
console.log('Missing prefixes in TE:', tePrefixes);

// Check if any keys are in hi/te/ta but not in en
const extraHi = [...hiKeys].filter(k => !enKeys.has(k));
const extraTe = [...teKeys].filter(k => !enKeys.has(k));
const extraTa = [...taKeys].filter(k => !enKeys.has(k));
console.log('Extra in HI:', extraHi.length);
console.log('Extra in TE:', extraTe.length);
console.log('Extra in TA:', extraTa.length);
