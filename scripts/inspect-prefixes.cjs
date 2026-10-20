const fs = require('fs');

const missing = JSON.parse(fs.readFileSync('scripts/missing-keys.json', 'utf8'));
const grouped = {};
missing.forEach(item => {
  const prefix = item.key.split('.')[0];
  if (!grouped[prefix]) grouped[prefix] = [];
  grouped[prefix].push(item);
});

for (const [k, v] of Object.entries(grouped)) {
  console.log(`=== Prefix: ${k} (${v.length} keys) ===`);
  v.slice(0, 5).forEach(i => console.log(`  ${i.key}: ${i.en} | ${i.ta}`));
}
