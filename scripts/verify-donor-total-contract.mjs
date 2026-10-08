import assert from 'node:assert/strict';import fs from 'node:fs';import {computeBreakdown,computeChargeTotal,computePayPalProcessingFee} from '../base44/shared/fees.js';
for(const total of [1,25,50,100,250,999.99]){const b=computeBreakdown(total,false);assert.equal(b.totalCharged,total);assert.equal(computeChargeTotal(total),total);assert.equal(Number((b.amount+b.processing).toFixed(2)),total);assert.ok(b.recipientNet<=b.amount);}
assert.ok(computePayPalProcessingFee(100)>0);assert.ok(computePayPalProcessingFee(100)<100);
const stripe=fs.readFileSync('base44/functions/createDonationCheckout/entry.ts','utf8'),paypal=fs.readFileSync('base44/functions/createPayPalOrder/entry.ts','utf8'),gpay=fs.readFileSync('src/components/payments/GooglePayButton.jsx','utf8');
assert.match(stripe,/const totalCharge = round2\(Number\(amount\)\)/);assert.match(stripe,/const value = round2\(totalCharge - processing\)/);assert.match(paypal,/const value = round2\(totalCharge - processing\)/);
assert.match(gpay,/const financialIntentKey = \[campaign\.id, value\.toFixed\(2\), "googlepay", selectedContribution \? "1" : "0"\]/);
assert.match(gpay,/if \(intentRef\.current\.key !== financialIntentKey\)/);
assert.match(gpay,/intentRef\.current = \{ key: financialIntentKey, id: crypto\.randomUUID\(\) \}/);
console.log('Donor-entered total, fee derivation, and stable Google Pay intent contract passed.');
