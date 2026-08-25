import fs from 'node:fs';

const steps = fs.readFileSync('src/components/onboarding/onboardingSteps.js', 'utf8');
const connect = fs.readFileSync('src/components/onboarding/ConnectStep.jsx', 'utf8');

for (const platform of ['facebook_pages', 'instagram', 'tiktok', 'linkedin']) {
  if (!new RegExp(`id: "${platform}"[\\s\\S]{0,120}status: "setup_required"`).test(steps)) {
    throw new Error(`Expected ${platform} to be marked setup_required until an authoritative OAuth connector exists.`);
  }
}

if (!connect.includes('setup_required: { label: "Setup required"')) {
  throw new Error('ConnectStep must render the setup_required state explicitly.');
}

if (!connect.includes('const disabled = item.status === "coming_soon" || item.status === "setup_required";')) {
  throw new Error('Unconfigured integrations must not be presented as selectable connections.');
}

if (connect.includes('connections authorize later from Mission Control')) {
  throw new Error('Onboarding must not imply a connection workflow exists when the connector is not implemented/configured.');
}

console.log('Onboarding capability status contract passed.');
