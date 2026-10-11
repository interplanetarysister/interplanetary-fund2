import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const page=read('src/pages/Agents.jsx');
const chat=read('src/components/agents/AgentChat.jsx');
const admin=read('src/components/agents/AdminDevelopmentChat.jsx');
const conn=read('src/pages/Connections.jsx');
const integrations=read('src/pages/IntegrationsAdmin.jsx');
assert.match(page,/const \[chatMode, setChatMode\] = useState\("chat"\)/);
assert.match(page,/canUseAdminTools && chatMode === "admin"\s*\? <AdminDevelopmentChat user=\{user\} \/>\s*: <AgentChat/, 'Two separate chat composers must never be presented together');
assert.match(page,/aria-pressed=\{chatMode === "chat"\}/);
assert.match(page,/aria-pressed=\{chatMode === "admin"\}/);
assert.match(page,/View AI work and progress/);
assert.match(page,/<details/, 'Agent progress is optional instead of covering the chat');
assert.match(page,/Tell me which account you want to connect or fix/, 'Connection-agent guidance must be plain language');
assert.match(chat,/Connect an account/);
assert.match(chat,/to="\/connections"/);
assert.match(chat,/data-ifund-chat-composer/, 'Mobile composer must remain accessible');
assert.doesNotMatch(conn,/<AdminOAuthProviderReadiness/, 'Ordinary Connections must be free of developer setup instructions');
assert.match(integrations,/<AdminOAuthProviderReadiness/, 'Admins still have their integration setup screen');
for(const name of ['chief_of_staff','managed_connection_agent','connection_discovery_agent','outreach_agent']){
  const instructions=JSON.parse(read('base44/agents/'+name+'.jsonc')).instructions;
  assert.match(instructions,/\/connections/, name+' must direct members to IFund Connections');
  assert.match(instructions,/developer|administ|API keys|provider/i, name+' must distinguish member and admin steps');
}
assert.match(admin,/Verify admin access/, 'Super-admin verification remains accessible in admin mode');
console.log('PASS: one AI chat workspace, optional progress, simple connection instructions and isolated admin setup');
