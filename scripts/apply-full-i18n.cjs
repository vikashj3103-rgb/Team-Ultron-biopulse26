const fs = require('fs');
const { hiTranslations, teTranslations } = require('./translations-hi-te.cjs');
const { hiTranslationsPart2, teTranslationsPart2 } = require('./translations-hi-te-part2.cjs');
const { enExtra, taExtra } = require('./extra-en-ta.cjs');

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

const newEnKeys = {
  'status.syncedJustNow': 'Synced just now',
  'status.syncedSecAgo': 'Synced {sec}s ago',
  'status.syncedMinAgo': 'Synced {min}m ago',
  'status.live': 'LIVE',
  'status.local': 'LOCAL',
  'status.offline': 'OFFLINE',
  'status.reconnecting': 'RECONNECTING',
  'status.thisBrowser': 'This browser',

  'relation.grandson': 'Grandson',
  'relation.daughter': 'Daughter',
  'relation.brother': 'Brother',
  'relation.son': 'Son',
  'relation.spouse': 'Spouse',
  'relation.wife': 'Wife',
  'relation.husband': 'Husband',
  'relation.sister': 'Sister',
  'relation.father': 'Father',
  'relation.mother': 'Mother',
  'relation.caregiver': 'Caregiver',
  'relation.family_caregiver': 'Family Caregiver',
  'relation.family_attender': 'Family Attender',
  'relation.relative': 'Relative',
  'relation.friend': 'Friend',
  'relation.guardian': 'Guardian',

  'nav.nonClinicalCaregiver': 'NON-CLINICAL FAMILY CAREGIVER',
  'nav.familyGuideTooltip': 'Family Caregiver Guide & Tutorial',
  'nav.familyGuideAria': 'Open Family Caregiver Guide and Tutorial',
  'nav.defaultCaregiver': 'Caregiver',
  'nav.familyAttender': 'Family Attender',
  'attender.caregiver': 'Caregiver',
  'attender.attenderBadge': 'Attender',

  'map.mode3D': '3D Isometric',
  'map.mode2D': '2D Blueprint',
  'map.resetView': 'Reset View',
  'map.rotateLeft': 'Rotate Left',
  'map.rotateRight': 'Rotate Right',
  'map.zoomIn': 'Zoom In',
  'map.zoomOut': 'Zoom Out',
  'map.allFloors': 'All Floors 3D',
  'map.floor0': 'Ground Floor',
  'map.currentLocation': 'Your Location',
  'map.turnByTurn': 'Turn-by-Turn Directions',
  'map.estimatedTime': 'Estimated Walking Time',
  'map.distance': 'Distance',
  'map.meters': 'm',
  'map.minutes': 'min',
  'map.elevatorTransit': 'Elevator Transit',
  'map.stairsTransit': 'Stairs Transit',
  'map.floorChange': 'Floor {from} to Floor {to}',
  'map.popularDestinations': 'Popular Destinations',
  'map.step': 'Step {number}',
  'map.roomDetails': 'Room Details',
  'map.statusOccupied': 'Occupied',
  'map.statusAvailable': 'Available',
  'map.instructionsHeading': 'Walking Guidance',
  'map.tapRoomToNavigate': 'Tap any room to set as destination',
  'map.multiFloorElevator': 'Take central elevator to target floor',
  'map.headerTitle': 'Hospital Map & Directions',
  'map.headerSubtitle': 'Choose a destination to see the route, floor changes, and walking distance.',
  'map.from': 'From',
  'map.to': 'To',
  'map.aboutMinutes': 'about {min} min',
  'map.floorChangeElevator': 'Floor change · elevator or stairs',
  'map.sameFloor': 'Same floor',
  'map.suggestedDestinations': 'Suggested Destinations',
  'map.floorGroundFull': 'Ground Floor (Reception & Pharmacy)',
  'map.floor1Full': 'Floor 1 (ICU & Inpatient)',
  'map.floor2Full': 'Floor 2 (Cardiology & Surgery)',
  'map.turnByTurnDesc': 'Follow the numbered directions from your current location.',
  'map.selectToViewDirections': 'Select origin and destination to view step-by-step directions.',
  'map.footerNotice': 'HealthConnect indoor wayfinding navigation map.',
  'map.destPharmacy': 'Pharmacy · Ground Floor',
  'map.destIcu': 'ICU · Room 204',
  'map.destLab': 'Pathology Laboratory',
  'map.destRadiology': 'Radiology & Imaging',
  'map.destEmergency': 'Emergency Department',
  'map.destGenMed': 'Ward 1 (General Medicine)',
  'map.destCardiology': 'Cardiology · Room 11002',
  'map.legendCurrent': 'Current Location',
  'map.legendDestination': 'Destination',
  'map.elevatorTransfer': 'Take Lift',
  'map.elevatorRoute': 'Elevator Route',
  'tour.guideTitle': 'System Guide',
};

const newTaKeys = {
  'status.syncedJustNow': 'இப்போது ஒத்திசைக்கப்பட்டது',
  'status.syncedSecAgo': '{sec} வினாடி முன் ஒத்திசைக்கப்பட்டது',
  'status.syncedMinAgo': '{min} நிமிடம் முன் ஒத்திசைக்கப்பட்டது',
  'status.live': 'நேரலை',
  'status.local': 'உள்ளூர்',
  'status.offline': 'இணைப்பில்லை',
  'status.reconnecting': 'மீண்டும் இணைக்கிறது',
  'status.thisBrowser': 'இந்த உலாவி',

  'relation.grandson': 'பேரன்',
  'relation.daughter': 'மகள்',
  'relation.brother': 'சகோதரன்',
  'relation.son': 'மகன்',
  'relation.spouse': 'துணைவர்',
  'relation.wife': 'மனைவி',
  'relation.husband': 'கணவர்',
  'relation.sister': 'சகோதரி',
  'relation.father': 'தந்தை',
  'relation.mother': 'தாய்',
  'relation.caregiver': 'பராமரிப்பாளர்',
  'relation.family_caregiver': 'குடும்ப பராமரிப்பாளர்',
  'relation.family_attender': 'குடும்ப உதவியாளர்',
  'relation.relative': 'உறவினர்',
  'relation.friend': 'நண்பர்',
  'relation.guardian': 'பாதுகாவலர்',

  'nav.nonClinicalCaregiver': 'மருத்துவப் பணியாளர் அல்லாத குடும்பப் பராமரிப்பாளர்',
  'nav.familyGuideTooltip': 'குடும்ப பராமரிப்பாளர் வழிகாட்டி மற்றும் பயிற்சி',
  'nav.familyGuideAria': 'குடும்ப பராமரிப்பாளர் வழிகாட்டியைத் திறக்கவும்',
  'nav.defaultCaregiver': 'பராமரிப்பாளர்',
  'nav.familyAttender': 'குடும்ப உதவியாளர்',
  'attender.caregiver': 'பராமரிப்பாளர்',
  'attender.attenderBadge': 'உதவியாளர்',

  'map.mode3D': '3டி ஐசோமெட்ரிக்',
  'map.mode2D': '2டி வரைபடம்',
  'map.resetView': 'பார்வையை மீட்டமை',
  'map.rotateLeft': 'இடதுபுறம் சுழற்று',
  'map.rotateRight': 'வலதுபுறம் சுழற்று',
  'map.zoomIn': 'பெரிதாக்கு',
  'map.zoomOut': 'சிறிதாக்கு',
  'map.allFloors': 'அனைத்து தளங்கள் 3டி',
  'map.floor0': 'தரைத்தளம்',
  'map.currentLocation': 'உங்கள் இருப்பிடம்',
  'map.turnByTurn': 'வழிமுறை வழிகாட்டல்',
  'map.estimatedTime': 'தோராயமான நடைபயண நேரம்',
  'map.distance': 'தூரம்',
  'map.meters': 'மீ.',
  'map.minutes': 'நிமிடம்',
  'map.elevatorTransit': 'லிஃப்ட் பயணம்',
  'map.stairsTransit': 'படிக்கட்டு வழி',
  'map.floorChange': 'தளம் {from} இலிருந்து தளம் {to}',
  'map.popularDestinations': 'பிரபலமான இடங்கள்',
  'map.step': 'படி {number}',
  'map.roomDetails': 'அறை விவரங்கள்',
  'map.statusOccupied': 'பயன்பாட்டில் உள்ளது',
  'map.statusAvailable': 'காலியாக உள்ளது',
  'map.instructionsHeading': 'நடைபயண வழிகாட்டுதல்',
  'map.tapRoomToNavigate': 'இலக்காக அமைக்க ஏதேனும் அறையைத் தட்டவும்',
  'map.multiFloorElevator': 'இலக்கு தளத்தை அடைய மைய லிஃப்ட்டைப் பயன்படுத்தவும்',
  'map.headerTitle': 'மருத்துவமனை வரைபடம் & வழிகள்',
  'map.headerSubtitle': 'பாதை, தளம் மாற்றம் மற்றும் நடை தூரத்தைக் காண ஒரு இலக்கைத் தேர்வுசெய்க.',
  'map.from': 'இருந்து',
  'map.to': 'செல்லும் இடம்',
  'map.aboutMinutes': 'சுமார் {min} நிமிடம்',
  'map.floorChangeElevator': 'தளம் மாற்றம் · லிஃப்ட் அல்லது படிக்கட்டு',
  'map.sameFloor': 'ஒரே தளம்',
  'map.suggestedDestinations': 'பரிந்துரைக்கப்பட்ட இடங்கள்',
  'map.floorGroundFull': 'தரைத்தளம் (வரவேற்பு & மருந்தகம்)',
  'map.floor1Full': 'தளம் 1 (தீவிர சிகிச்சைப் பிரிவு & உள்நோயாளி)',
  'map.floor2Full': 'தளம் 2 (இதயவியல் & அறுவை சிகிச்சை)',
  'map.turnByTurnDesc': 'உங்கள் தற்போதைய இடத்திலிருந்து எண்ணிடப்பட்ட வழிமுறைகளைப் பின்பற்றவும்.',
  'map.selectToViewDirections': 'படி படியான வழிகாட்டுதலைக் காண தொடக்க மற்றும் சேருமிடத்தைத் தேர்வுசெய்யவும்.',
  'map.footerNotice': 'HealthConnect உள்நோயாளி வழிசெலுத்தல் வரைபடம்.',
  'map.destPharmacy': 'மருந்தகம் · தரைத்தளம்',
  'map.destIcu': 'தீவிர சிகிச்சை · அறை 204',
  'map.destLab': 'நோயியல் ஆய்வகம்',
  'map.destRadiology': 'கதிரியக்கவியல் & ஸ்கேன்',
  'map.destEmergency': 'அவசர சிகிச்சை பிரிவு',
  'map.destGenMed': 'வார்டு 1 (பொது மருத்துவம்)',
  'map.destCardiology': 'இதயவியல் · அறை 11002',
  'map.legendCurrent': 'தற்போதைய இடம்',
  'map.legendDestination': 'சேருமிடம்',
  'map.elevatorTransfer': 'லிஃப்டில் செல்லவும்',
  'map.elevatorRoute': 'லிஃப்ட் வழித்தடம்',
  'tour.guideTitle': 'அமைப்பு வழிகாட்டி',
};

// Merge into final dictionaries
const finalEn = { ...enDict, ...newEnKeys, ...enExtra };
const finalTa = { ...taDict, ...newTaKeys, ...taExtra };
const finalHi = { ...hiBase, ...hiTranslations, ...hiTranslationsPart2 };
const finalTe = { ...teBase, ...teTranslations, ...teTranslationsPart2 };

const allKeys = Object.keys(finalEn);
console.log('Total keys in finalEn:', allKeys.length);

const missingHi = allKeys.filter(k => !finalHi[k]);
const missingTe = allKeys.filter(k => !finalTe[k]);
const missingTa = allKeys.filter(k => !finalTa[k]);

console.log('Missing in finalHi:', missingHi.length);
if (missingHi.length > 0) {
  console.log('Missing keys in HI:', missingHi);
}
console.log('Missing in finalTe:', missingTe.length);
if (missingTe.length > 0) {
  console.log('Missing keys in TE:', missingTe);
}
console.log('Missing in finalTa:', missingTa.length);
if (missingTa.length > 0) {
  console.log('Missing keys in TA:', missingTa);
}

// Generate formatted TypeScript file
function formatDict(dictName, dict) {
  const sortedKeys = Object.keys(dict).sort();
  let code = `export const ${dictName}: Record<string, string> = {\n`;
  for (const k of sortedKeys) {
    const val = dict[k].replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    code += `  '${k}': '${val}',\n`;
  }
  code += `};\n`;
  return code;
}

if (missingHi.length === 0 && missingTe.length === 0 && missingTa.length === 0) {
  console.log('Writing updated files with 100% key parity across all 4 languages...');
  fs.writeFileSync('src/i18n/translations/en.ts', formatDict('en', finalEn), 'utf8');
  fs.writeFileSync('src/i18n/translations/ta.ts', formatDict('ta', finalTa), 'utf8');
  fs.writeFileSync('src/i18n/translations/hi.ts', formatDict('hi', finalHi), 'utf8');
  fs.writeFileSync('src/i18n/translations/te.ts', formatDict('te', finalTe), 'utf8');
  console.log('SUCCESS: All 4 language files written with', allKeys.length, 'keys each!');
} else {
  console.error('ERROR: Key parity check failed! Please fix missing keys before writing.');
}
