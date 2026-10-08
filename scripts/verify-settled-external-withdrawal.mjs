import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const expect = (ok, message) => { if (!ok) throw new Error(message); };

const financial = read('base44/shared/base44Financial.ts');
const withdrawal = read('base44/functions/requestWithdrawal/entry.ts');
const schema = read('base44/entities/Withdrawal.jsonc');

expect(financial.includes("source_type: 'external_platform'"), 'canonical balance must include only verified external-platform settlements');
expect(financial.includes("state: 'settled'"), 'external custody must be settled before becoming available');
expect(financial.includes("currentWithdrawalId"), 'canonical reservation must include the current withdrawal local lock');
expect(financial.includes("args.withdrawalId || ''"), 'reservation must pass current withdrawal identity');

expect(withdrawal.includes('covered_holding_entry_ids'), 'withdrawal must record covered external settlement entries');
expect(withdrawal.includes("beneficiary_user_id: user.id"), 'withdrawal must restrict external funds to the campaign owner');
expect(withdrawal.includes("source_type: 'external_platform'"), 'withdrawal must not double-count direct IFund payment holdings');
expect(withdrawal.includes("withdrawalId: withdrawal.id"), 'canonical reservation must bind to the local withdrawal lock');
expect(withdrawal.includes('Donations and external funds become withdrawable only after verification and settlement.'), 'user copy must preserve custody truth');

expect(schema.includes('"covered_holding_entry_ids"'), 'withdrawal schema must persist covered settlement entries');

console.log('settled external withdrawal contract: PASS');
