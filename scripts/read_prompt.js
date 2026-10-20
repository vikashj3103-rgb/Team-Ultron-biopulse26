const fs = require('fs');
const transcriptPath = 'C:/Users/vikash/.gemini/antigravity/brain/1d353b1e-a698-49c3-a707-80221030c984/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i].trim();
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'USER_INPUT') {
      fs.writeFileSync('temp_prompt.txt', obj.content || '');
      console.log('Saved prompt, length:', (obj.content || '').length);
      break;
    }
  } catch (e) {}
}
