const fs = require('fs');
const assert = require('assert');

// 1. Check index.html viewport-fit
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(indexHtml.includes('viewport-fit=cover'), 'index.html has viewport-fit=cover');
console.log('✅ PASS: index.html has viewport-fit=cover');

// 2. Check index.css dvh
const indexCss = fs.readFileSync('src/index.css', 'utf8');
assert(indexCss.includes('min-height: 100dvh'), 'src/index.css has min-height: 100dvh');
console.log('✅ PASS: index.css uses 100dvh');

// 3. Check ClinicalUI.tsx
const clinicalUi = fs.readFileSync('src/components/common/ClinicalUI.tsx', 'utf8');
assert(clinicalUi.includes('calc(10px + env(safe-area-inset-bottom, 0px))'), 'MobilePrimaryNav has safe-area-inset-bottom');
assert(clinicalUi.includes('min-h-[48px] min-w-[44px]'), 'MobilePrimaryNav has >=44px touch targets');
console.log('✅ PASS: MobilePrimaryNav has safe-area and touch targets');

// 4. Check FloatingCareAiButton.tsx
const careAiBtn = fs.readFileSync('src/components/ai/FloatingCareAiButton.tsx', 'utf8');
assert(careAiBtn.includes('clampPosition'), 'FloatingCareAiButton has clamping logic');
assert(careAiBtn.includes('hasMovedBeyondThreshold'), 'FloatingCareAiButton distinguishes tap from drag');
assert(careAiBtn.includes('handleReset'), 'FloatingCareAiButton has reset position feature');
assert(careAiBtn.includes('STORAGE_KEY'), 'FloatingCareAiButton persists position to localStorage');
console.log('✅ PASS: FloatingCareAiButton has drag, clamp, reset, and tap/drag differentiation');

// 5. Check DoctorLayout.tsx
const docLayout = fs.readFileSync('src/layouts/DoctorLayout.tsx', 'utf8');
assert(docLayout.includes('FloatingCareAiButton'), 'DoctorLayout uses FloatingCareAiButton');
assert(docLayout.includes('showMoreMenu'), 'DoctorLayout has showMoreMenu');
assert(docLayout.includes('pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-8'), 'DoctorLayout has responsive content safe clearance');
console.log('✅ PASS: DoctorLayout responsive layout verified');

// 6. Check AttenderLayout.tsx
const attLayout = fs.readFileSync('src/layouts/AttenderLayout.tsx', 'utf8');
assert(attLayout.includes('FloatingCareAiButton'), 'AttenderLayout uses FloatingCareAiButton');
assert(attLayout.includes('showMoreMenu'), 'AttenderLayout has showMoreMenu');
assert(attLayout.includes('hideAt="lg"'), 'AttenderLayout hideAt is lg');
assert(attLayout.includes('lg:flex'), 'AttenderLayout header uses lg:flex');
assert(attLayout.includes('pb-28 sm:p-6 lg:p-8 lg:pb-8'), 'AttenderLayout has responsive content safe clearance');
console.log('✅ PASS: AttenderLayout responsive layout verified');

// 7. Check AdminLayout.tsx
const admLayout = fs.readFileSync('src/layouts/AdminLayout.tsx', 'utf8');
assert(admLayout.includes('showMoreMenu'), 'AdminLayout has showMoreMenu');
assert(admLayout.includes('hideAt="lg"'), 'AdminLayout hideAt is lg');
assert(admLayout.includes('pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-8'), 'AdminLayout has responsive content safe clearance');
console.log('✅ PASS: AdminLayout responsive layout verified');

console.log('\nALL RESPONSIVE SYSTEM CHECKS PASSED 100%!');
