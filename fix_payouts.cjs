const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix routes
  content = content.replace(/"\/_authenticated\/dashboard"/g, '"/_authenticated/payouts/"');
  content = content.replace(/"\/_authenticated\/invoices\/([^"]*)"/g, '"/_authenticated/payouts/$1"');
  
  // Imports
  content = content.replace(/fetchReceipt/g, 'fetchPayout');
  content = content.replace(/fetchReceipts/g, 'fetchPayouts');
  content = content.replace(/updateReceipt/g, 'updatePayout');
  content = content.replace(/softDeleteReceipt/g, 'softDeletePayout');
  content = content.replace(/storeReceiptPdf/g, 'storePayoutPdf');
  
  content = content.replace(/import \{ (.*) \} from "@\/lib\/api";/g, (match, p1) => {
    // Keep things like attachEvidence from api.ts if needed, but we already replaced them above in new.tsx
    // Let's just import them from payouts-api
    return `import { ${p1} } from "@/lib/payouts-api";`;
  });

  // Common UI replacements
  content = content.replace(/invoice/g, 'payout');
  content = content.replace(/Invoice/g, 'Payout');
  content = content.replace(/INVOICE/g, 'PAYOUT');

  content = content.replace(/receipt/g, 'payout');
  content = content.replace(/Receipt/g, 'Payout');
  content = content.replace(/RECEIPT/g, 'PAYOUT');

  fs.writeFileSync(filePath, content);
}

const dir = 'src/routes/_authenticated/payouts';
fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.tsx')) {
    processFile(path.join(dir, file));
  }
});
