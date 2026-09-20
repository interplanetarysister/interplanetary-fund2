import fs from 'node:fs';

const path = 'base44/entities/SocialPost.jsonc';
const schema = JSON.parse(fs.readFileSync(path, 'utf8'));
const source = schema.properties?.source_platform;
const externalId = schema.properties?.external_post_id;
const externalUrl = schema.properties?.external_url;

const expectedPlatforms = ['facebook', 'instagram', 'tiktok', 'linkedin', 'discord', null];
if (!source || JSON.stringify(source.enum) !== JSON.stringify(expectedPlatforms)) {
  throw new Error('SocialPost.source_platform must use the bounded supported-platform enum plus null');
}
if (JSON.stringify(externalId?.type) !== JSON.stringify(['string', 'null'])) {
  throw new Error('SocialPost.external_post_id must allow string or null while backend identity rules are enforced');
}
if (JSON.stringify(externalUrl?.type) !== JSON.stringify(['string', 'null'])) {
  throw new Error('SocialPost.external_url must allow string or null');
}

const text = fs.readFileSync(path, 'utf8');
for (const marker of [
  'Must be paired with source_platform',
  'must be null for native posts',
  'Server-side authorization remains authoritative'
]) {
  if (!text.includes(marker)) throw new Error(`Missing SocialPost contract marker: ${marker}`);
}

console.log('SocialPost external identity schema contract verified');
