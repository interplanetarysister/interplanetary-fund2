import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCampaignParity } from './campaign-parity-audit.mjs';
const ID='campaign0001', OWNER='owner0001';
const source = () => ({ id:ID, created_by_id:OWNER, updated_date:'2026-10-23T12:00:00.000000', title:'Private campaign title', status:'active', goal_amount:100, ai_profile:{ b:2, a:1 }, story_versions:[{ b:2,a:1 }], outreach_last_run_at:'2026-10-23T12:00:00.000000' });
const staged = () => ({ source_id:ID, source_owner_id:OWNER, source_updated_at:'2026-10-23T12:00:00.000000', title:'Private campaign title', status:'active', goal_amount:'100.00', ai_profile:{a:1,b:2}, story_versions:[{a:1,b:2}], outreach_last_run_at:'2026-10-23T12:00:00.000000', financial_authoritative:false });
test('equal content and canonically equivalent nested JSON do not drift',()=>{const x=auditCampaignParity([source()],[staged()]);assert.equal(x.contentDrift.length,0);assert.equal(x.stale.length,0);assert.equal(x.cutoverReady,false)});
test('newer source timestamp plus outreach update is stale operational drift only',()=>{const d=staged();d.source_updated_at='2026-10-22T12:00:00.000000';d.outreach_last_run_at='2026-10-22T12:00:00.000000';const x=auditCampaignParity([source()],[d]);assert.deepEqual(x.stale,[ID]);assert.equal(x.contentDrift.length,0);assert.deepEqual(x.operationalDrift[0].fields,['outreach_last_run_at'])});
test('content change is reported only by ID and field name, not private value',()=>{const d=staged();d.title='Old private title';const x=auditCampaignParity([source()],[d]);assert.deepEqual(x.contentDrift,[{id:ID,fields:['title']}]);assert.doesNotMatch(JSON.stringify(x),/Private campaign title|Old private title/)});
test('cross-owner mismatch remains visible even with matching content',()=>{const d=staged();d.source_owner_id='owner0002';assert.deepEqual(auditCampaignParity([source()],[d]).ownerDrift,[ID])});
test('missing and orphaned records never count as parity',()=>{const d=staged();d.source_id='campaign0002';const x=auditCampaignParity([source()],[d]);assert.deepEqual(x.missing,[ID]);assert.deepEqual(x.orphaned,['campaign0002'])});
test('invalid or duplicate IDs are rejected',()=>{assert.throws(()=>auditCampaignParity([source(),source()],[staged()]),/duplicate/);assert.throws(()=>auditCampaignParity([{...source(),id:'../'}],[staged()]),/Invalid/)});
test('missing timestamps and future-dated destination fail closed',()=>{let d=staged();d.source_updated_at='bad';assert.deepEqual(auditCampaignParity([source()],[d]).timestampErrors,[ID]);d=staged();d.source_updated_at='2026-10-24T12:00:00';assert.deepEqual(auditCampaignParity([source()],[d]).timestampErrors,[ID])});
test('money snapshot cannot confer authority',()=>{const d=staged();d.financial_authoritative=true;assert.throws(()=>auditCampaignParity([source()],[d]),/Financial authority/)});
test('money snapshots are excluded from comparisons',()=>{const d=staged();d.raised_amount_snapshot=999999;d.donor_count_snapshot=900;const x=auditCampaignParity([source()],[d]);assert.equal(x.contentDrift.length,0);assert.equal(x.financialAuthorityVerified,false)});
test('no input mutation',()=>{const a=source(),b=staged(),before=JSON.stringify([a,b]);auditCampaignParity([a],[b]);assert.equal(JSON.stringify([a,b]),before)});

test('orphaned shadow rows cannot bypass the financial authority invariant', () => {
  const orphan = { ...staged(), source_id: 'campaign0002', financial_authoritative: true };
  assert.throws(() => auditCampaignParity([source()], [orphan]), /Financial authority violation/);
});
