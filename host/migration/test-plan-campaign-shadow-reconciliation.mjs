import test from 'node:test';
import assert from 'node:assert/strict';
import { planCampaignShadowReconciliation as plan } from './plan-campaign-shadow-reconciliation.mjs';
const ID='campaign0001', OWNER='owner0001';
const hash='a'.repeat(64), uid='123e4567-e89b-12d3-a456-426614174000';
const source=()=>({id:ID,created_by_id:OWNER,status:'active',updated_date:'2026-10-24T01:00:00Z',accept_crypto_donations:false,ai_profile:{private:'SECRET',b:2,a:1},story_versions:[],outreach_last_run_at:'2026-10-24T01:00:00Z'});
const shadow=()=>({source_id:ID,source_owner_id:OWNER,status:'active',source_updated_at:'2026-10-24T00:00:00Z',source_sha256:hash,financial_authoritative:false,accept_crypto_donations:null,ai_profile:null,story_versions:null,outreach_last_run_at:null});
const owner=()=>({source_owner_id:OWNER,verification_state:'verified',destination_auth_uid:uid});
const run=(s=[source()],d=[shadow()],o=[owner()])=>plan(s,d,o);
test('non-executable plan reports only IDs and field names, never private values',()=>{
 const r=run(); assert.equal(r.anyWriteAuthorized,false); assert.equal(r.cutoverReady,false);
 assert.equal(r.optionalGapCount,1); assert.equal(r.operationalDriftCount,1);
 assert.deepEqual(r.records[0].optionalFields,['accept_crypto_donations','ai_profile','story_versions']);
 assert.doesNotMatch(JSON.stringify(r),/SECRET|123e4567|a{64}/);
});
test('verified mapping is insufficient for execution without owner JWT and provenance',()=>{
 const r=run(); assert.equal(r.records[0].applyAllowed,false);
 assert.ok(r.records[0].blockers.includes('fresh_owner_session_hash_and_rollback_evidence_required'));
});
test('pending owner map blocks reconciliation even when source and staging match',()=>{
 const r=run([source()],[shadow()],[{...owner(),verification_state:'awaiting_destination_login',destination_auth_uid:null}]);
 assert.equal(r.pendingOwnerCount,1); assert.ok(r.records[0].blockers.includes('owner_auth_not_verified'));
});
test('missing owner mapping blocks reconciliation',()=>{
 const r=run([source()],[shadow()],[]); assert.equal(r.pendingOwnerCount,1);
});
test('staged null is not silently treated as source false or empty arrays',()=>{
 const r=run(); assert.ok(r.records[0].optionalFields.includes('accept_crypto_donations'));
 assert.ok(r.records[0].optionalFields.includes('story_versions'));
});
test('canonical nested JSON with changed key order is equivalent',()=>{
 const d={...shadow(),ai_profile:{a:1,b:2,private:'SECRET'},story_versions:[],accept_crypto_donations:false};
 assert.equal(run([source()],[d]).optionalGapCount,0);
});
test('malformed and duplicate records fail closed',()=>{
 assert.throws(()=>run(null,[],[]),/array/);
 assert.throws(()=>run([null],[],[]),/Malformed/);
 assert.throws(()=>run([source(),source()],[],[]),/duplicate/);
 assert.throws(()=>run([source()],[shadow(),shadow()],[]),/duplicate/);
 assert.throws(()=>run([source()],[shadow()],[owner(),owner()]),/duplicate/);
});
test('orphan shadow with financial authority is rejected',()=>{
 assert.throws(()=>run([], [{...shadow(),financial_authoritative:true}], []),/Financial authority/);
 assert.throws(()=>run([], [{...shadow(),financial_authoritative:null}], []),/Financial authority/);
});
test('orphan and missing shadows remain blocked',()=>{
 const orphan=run([], [shadow()], []);assert.deepEqual(orphan.records[0].blockers,['orphan_shadow']);
 const missing=run([source()], [], [owner()]);assert.deepEqual(missing.records[0].blockers,['missing_shadow']);
});
test('future staged timestamp, missing hash, and owner mismatch are reported',()=>{
 const d={...shadow(),source_updated_at:'2026-10-25T00:00:00Z',source_sha256:null,source_owner_id:'owner0002'};
 const r=run([source()],[d]);for(const key of ['invalid_timestamp_order','missing_or_invalid_staged_hash','source_owner_mismatch'])
 assert.ok(r.records[0].blockers.includes(key));
});
test('input objects are never mutated',()=>{
 const a=[source()],b=[shadow()],c=[owner()],before=JSON.stringify([a,b,c]);run(a,b,c);assert.equal(JSON.stringify([a,b,c]),before);
});
test('no payment, ledger, source values or credentials appear in output',()=>{
 const a=source();a.raised_amount=12345;a.story='TOP SECRET STORY';a.access_token='TOP SECRET TOKEN';
 const r=run([a]);assert.doesNotMatch(JSON.stringify(r),/TOP SECRET|12345|SECRET/);
});

test('two source owners cannot share a verified destination identity',()=>{
 const a=owner(), b={...owner(),source_owner_id:'owner0002',destination_auth_uid:uid.toUpperCase()};
 assert.throws(()=>run([source()],[shadow()],[a,b]),/Conflicting verified destination owner mapping/);
});
test('unverified owner cannot carry a destination auth UID',()=>{
 assert.throws(()=>run([source()],[shadow()],[{...owner(),verification_state:'awaiting_destination_login'}]),/Unverified owner mapping contains destination identity/);
});
test('verified owner must carry a valid destination auth UID',()=>{
 assert.throws(()=>run([source()],[shadow()],[{...owner(),destination_auth_uid:'invalid'}]),/Verified owner mapping lacks valid destination identity/);
});


test('confirmed email candidate is explicitly insufficient for live owner authorization',()=>{
 const candidate={...owner(),candidate_match_method:'confirmed_exact_email',candidate_auth_uid:uid};
 const result=run([source()],[shadow()],[candidate]);
 assert.equal(result.emailOnlyEvidenceCount,1);
 assert.ok(result.records[0].blockers.includes('email_match_is_not_live_session_proof'));
 assert.equal(result.records[0].applyAllowed,false);
 assert.equal(result.liveOwnerJwtVerified,false);
 assert.doesNotMatch(JSON.stringify(result),/confirmed_exact_email|123e4567/);
});
test('missing candidate metadata does not falsely claim live JWT proof',()=>{
 const result=run();
 assert.equal(result.emailOnlyEvidenceCount,0);
 assert.equal(result.liveOwnerJwtVerified,false);
 assert.ok(result.records[0].blockers.includes('fresh_owner_session_hash_and_rollback_evidence_required'));
});

test('all campaign operational fields are tracked as provenance drift', () => {
 const fields = ['outreach_last_run_at','outreach_last_attempt_at','outreach_last_error',
   'social_last_generated_at','social_last_generation_attempt_at'];
 const src = source();
 const dst = shadow();
 for (const field of fields) {
   src[field] = `source-${field}`;
   dst[field] = `staged-${field}`;
 }
 const result = run([src],[dst],[owner()]);
 assert.deepEqual(result.records[0].operationalFields, fields);
 assert.ok(result.records[0].blockers.includes('operational_provenance_review'));
 assert.doesNotMatch(JSON.stringify(result), /source-outreach|staged-outreach/);
});
