const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'lib', 'pdf.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Rename BRAND_RED to BRAND_COLOR
content = content.replace(/BRAND_RED/g, 'BRAND_COLOR');

// 2. Update BRAND_COLOR definition to the light blue color #0EA5E9 (RGB: 14, 165, 233)
content = content.replace(
  /const BRAND_COLOR = \{ r: 200, g: 16, b: 32 \};/,
  'const BRAND_COLOR = { r: 14, g: 165, b: 233 };'
);

// 3. Keep warning red for unpaid balance due (around line 526)
content = content.replace(
  /doc\.setTextColor\(BRAND_COLOR\.r, BRAND_COLOR\.g, BRAND_COLOR\.b\);\s+doc\.text\("Balance Due:",/g,
  'doc.setTextColor(200, 16, 32); // Keep red for unpaid balance due\n        doc.text("Balance Due:",'
);

// 4. Keep warning red for unpaid outstanding balance in receipts (around line 1006)
content = content.replace(
  /outstanding > 0 \? BRAND_COLOR : \{r:34,g:150,b:80\}/g,
  'outstanding > 0 ? {r:200,g:16,b:32} : {r:34,g:150,b:80} // Keep red for unpaid outstanding balance'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated pdf.ts brand colors and generic red safeguards!');
