const fs = require('fs');

function parse(p) {
  const content = fs.readFileSync(p, 'utf8');
  const dict = {};
  const re = /['"]([^'"]+)['"]\s*:\s*(['"`](?:[\s\S]*?)['"`])\s*[,}]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    let val = m[2];
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) val = val.slice(1, -1);
    dict[m[1]] = val;
  }
  return dict;
}

const en = parse('src/i18n/translations/en.ts');
const hi = parse('src/i18n/translations/hi.ts');
const extra = Object.keys(hi).filter(k => !en[k]);
console.log('Extra in HI count:', extra.length);

const grouped = {};
extra.forEach(k => {
  const p = k.split('.')[0];
  grouped[p] = (grouped[p] || 0) + 1;
});
console.log('Grouped:', grouped);
fs.writeFileSync('scripts/extra-keys.json', JSON.stringify(extra, null, 2));
