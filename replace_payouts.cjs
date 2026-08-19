const fs = require('fs');

function transformDashboard() {
  let content = fs.readFileSync('src/routes/_authenticated/payouts/index.tsx', 'utf8');
  content = content.replace(/"\/_authenticated\/"/g, '"/_authenticated/payouts/"');
  content = content.replace(/DashboardPage/g, 'PayoutsDashboardPage');
  content = content.replace(/fetchReceipts/g, 'fetchPayouts');
  content = content.replace(/import \{ fetchPayouts \} from "@\/lib\/api";/g, 'import { fetchPayouts } from "@/lib/payouts-api";');
  content = content.replace(/Dashboard, Generative Invoices/g, 'Payouts, Generative Invoices');
  content = content.replace(/receipt/g, 'payout');
  content = content.replace(/Receipt/g, 'Payout');
  content = content.replace(/RECEIPT/g, 'PAYOUT');
  content = content.replace(/invoices/g, 'payouts');
  content = content.replace(/Invoices/g, 'Payouts');
  content = content.replace(/invoice/g, 'payout');
  content = content.replace(/Invoice/g, 'Payout');
  content = content.replace(/INVOICE/g, 'PAYOUT');
  fs.writeFileSync('src/routes/_authenticated/payouts/index.tsx', content);
}

function transformNew() {
  let content = fs.readFileSync('src/routes/_authenticated/payouts/new.tsx', 'utf8');
  content = content.replace(/"\/_authenticated\/invoices\/new"/g, '"/_authenticated/payouts/new"');
  content = content.replace(/GenerateInvoicePage/g, 'GeneratePayoutPage');
  content = content.replace(/createReceipt/g, 'createPayout');
  content = content.replace(/fetchReceipts/g, 'fetchPayouts');
  
  content = content.replace(/import \{ (.*)createPayout(.*) \} from "@\/lib\/api";/g, 'import { $1$2 } from "@/lib/api";\nimport { createPayout } from "@/lib/payouts-api";');
  content = content.replace(/attachEvidence/g, 'attachPayoutEvidence');
  content = content.replace(/import \{ (.*)attachPayoutEvidence(.*) \} from "@\/lib\/api";/g, 'import { $1$2 } from "@/lib/api";\nimport { attachPayoutEvidence } from "@/lib/payouts-api";');

  content = content.replace(/customerName/g, 'workerId');
  content = content.replace(/setCustomerName/g, 'setWorkerId');
  content = content.replace(/customerEmail/g, 'workerPhone');
  content = content.replace(/setCustomerEmail/g, 'setWorkerPhone');
  content = content.replace(/customerName\.trim\(\) \|\| null/g, 'workerId');
  content = content.replace(/customerEmail\.trim\(\) \|\| null/g, 'undefined');

  content = content.replace(/invoice/g, 'payout');
  content = content.replace(/Invoice/g, 'Payout');
  content = content.replace(/INVOICE/g, 'PAYOUT');

  content = content.replace(/import \{ Label \} from "@\/components\/ui\/label";/g, 'import { Label } from "@/components/ui/label";\nimport { WorkerSelect } from "@/components/WorkerSelect";');

  content = content.replace(
    /<div className="space-y-2">\s*<Label htmlFor="workerId">\{t\("payout.customerNameOpt"\)\}<\/Label>\s*<Input\s*id="workerId"\s*value=\{workerId\}\s*maxLength=\{160\}\s*onChange=\{\(e\) => setWorkerId\(e.target.value\)\}\s*\/>\s*<\/div>/,
    `<WorkerSelect\n  value={workerId}\n  onChange={(w) => {\n    setWorkerId(w.id);\n    setWorkerPhone(w.phone || "");\n  }}\n  t={t}\n/>`
  );

  content = content.replace(
    /<div className="space-y-2">\s*<Label htmlFor="workerPhone">\{t\("payout.customerEmailOpt"\)\}<\/Label>\s*<Input\s*id="workerPhone"\s*type="email"\s*value=\{workerPhone\}\s*maxLength=\{254\}\s*onChange=\{\(e\) => setWorkerPhone\(e.target.value\)\}\s*\/>\s*<\/div>/,
    `<div className="space-y-2">\n  <Label htmlFor="workerPhone">{t("payout.workerPhoneLabel")}</Label>\n  <Input\n    id="workerPhone"\n    value={workerPhone}\n    readOnly\n    disabled\n  />\n</div>`
  );

  fs.writeFileSync('src/routes/_authenticated/payouts/new.tsx', content);
}

try {
  transformDashboard();
} catch (e) { console.log(e); }
try {
  transformNew();
} catch (e) { console.log(e); }

