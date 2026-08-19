const fs = require('fs');

function fix(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Imports
  content = content.replace(/fetchReceipt/g, 'fetchPayout');
  content = content.replace(/updateReceipt/g, 'updatePayout');
  content = content.replace(/softDeleteReceipt/g, 'softDeletePayout');
  content = content.replace(/storeReceiptPdf/g, 'storePayoutPdf');
  
  content = content.replace(/import \{ (.*) \} from "@\/lib\/api";/g, (match, p1) => {
    return match + `\nimport { fetchPayout, updatePayout, softDeletePayout, storePayoutPdf } from "@/lib/payouts-api";`;
  });

  content = content.replace(/invoice/g, 'payout');
  content = content.replace(/Invoice/g, 'Payout');
  content = content.replace(/INVOICE/g, 'PAYOUT');
  content = content.replace(/receipt/g, 'payout');
  content = content.replace(/Receipt/g, 'Payout');
  content = content.replace(/RECEIPT/g, 'PAYOUT');

  // Fix API calls
  content = content.replace(/customerName/g, 'workerName');
  content = content.replace(/customerEmail/g, 'workerPhone');
  
  fs.writeFileSync(file, content);
}

['src/routes/_authenticated/payouts/$id.tsx', 'src/routes/_authenticated/payouts/$id_.edit.tsx'].forEach(f => {
  try { fix(f); } catch (e) {}
});
