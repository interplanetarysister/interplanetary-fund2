import fs from 'node:fs';

const panel = fs.readFileSync('src/components/platform/UserManagementPanel.jsx', 'utf8');
const workflow = fs.readFileSync('base44/functions/adminUserManagement/entry.ts', 'utf8');

const required = [
  ['panel uses authoritative workflow', panel.includes('base44.functions.invoke("adminUserManagement"')],
  ['panel has no direct User.list', !panel.includes('base44.entities.User.list')],
  ['panel has no direct User.update', !panel.includes('base44.entities.User.update')],
  ['panel uses safe load error', panel.includes('Unable to load user management data.')],
  ['panel uses safe role-update error', panel.includes("Unable to update the user's role.")],
  ['workflow authenticates caller', workflow.includes('base44.auth.me()')],
  ['workflow requires admin role', workflow.includes("user.role !== 'admin'")],
  ['workflow rejects self-demotion', workflow.includes('targetId === admin.id')],
  ['workflow exposes bounded projection', workflow.includes('USER_FIELDS')],
  ['workflow rejects invalid role', workflow.includes("body.role === 'admin' ? 'admin' : body.role === 'user' ? 'user' : null")],
  ['workflow uses service role for target operations', workflow.includes('base44.asServiceRole')],
  ['workflow returns safe unexpected errors', workflow.includes("SAFE_ERROR") && workflow.includes('Response.json({ error: SAFE_ERROR }')],
];

const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`User-management security verification failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('User-management security verification passed.');
