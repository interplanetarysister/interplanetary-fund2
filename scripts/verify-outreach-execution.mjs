import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = JSON.parse(fs.readFileSync('base44/workflows/AI Outreach Agent.jsonc','utf8'));
assert.equal(workflow.trigger.config.trigger_type, 'scheduled');
assert.equal(workflow.trigger.config.schedule_mode, 'recurring');
assert.equal(workflow.definition.do[0].run_agent.with.function_name, 'runOutreachAgent');

const source = fs.readFileSync('base44/functions/runOutreachAgent/entry.ts','utf8');
assert.match(source,/isFeatureEnabled\(base44, 'ai_outreach_agent'\)/);
assert.match(source,/hasSubscriptionLevel\(owner, 2\)/);
assert.match(source,/hasUnifiedOboConsent\(owner\)/);
assert.match(source,/status: 'active'/);
assert.match(source,/description: draftMessage/);
assert.match(source,/catch \(campaignError\)/);
const panel = fs.readFileSync('src/components/campaigns/OutreachAgentPanel.jsx','utf8');
assert.match(panel,/setEnabled\(\(value\) => !value\)/);
assert.match(panel,/finally \{\s*setEnabling\(false\)/);
assert.match(panel,/a\.description/);
assert.match(panel,/This draft has not been sent/);
assert.match(panel,/automationReady/);
const health = fs.readFileSync('src/pages/Connections.jsx','utf8');
assert.match(health,/\["connected", "error"\]/);
assert.match(health,/lastHealth/);
const shared = fs.readFileSync('base44/shared/verifiedConnectionCapabilities.ts','utf8');
assert.match(shared,/scopes\.add\('create_post'\)/);
console.log('AI outreach scheduling, consent, draft visibility and recovery checks passed.');
