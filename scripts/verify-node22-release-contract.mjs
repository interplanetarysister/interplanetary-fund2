import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

export function verifyReleaseContract(root=process.cwd()) {
  const errors=[];
  const read=(p)=>{ try{return readFileSync(join(root,p),'utf8')}catch{errors.push('missing:'+p);return ''} };
  const json=(p)=>{try{return JSON.parse(read(p))}catch{errors.push('malformed:'+p);return null}};
  const pkg=json('package.json');
  if(pkg?.engines?.node!=='>=20')errors.push('Node engine must allow Node 20 or newer without an upper bound');
  const nodeVersionMajor=Number(read('.node-version').trim().split('.')[0]);
  if(!Number.isFinite(nodeVersionMajor)||nodeVersionMajor<20)errors.push('.node-version must select Node 20 or newer');
  const nvmMajor=Number(read('.nvmrc').trim().split('.')[0]);
  if(!Number.isFinite(nvmMajor)||nvmMajor<20)errors.push('.nvmrc must select Node 20 or newer');
  const major=Number(process.versions.node.split('.')[0]);
  if(major<20)errors.push('Node 20 or newer required');
  const lock=json('package-lock.json');
  if(lock?.packages?.['']?.engines?.node!=='>=20')errors.push('Lockfile must declare Node >=20');
  let files=[];
  try{files=readdirSync(join(root,'.github/workflows')).filter(p=>/\.ya?ml$/.test(p))}
  catch{errors.push('missing:.github/workflows')}
  let found=0;
  for(const file of files){
    const p=join('.github/workflows',file);
    let workflow;
    try{workflow=yaml.load(read(p))}catch{errors.push('malformed:'+p);continue}
    for(const job of Object.values(workflow?.jobs||{})){
      for(const step of job?.steps||[]){
        if(!/^actions\/setup-node@/i.test(step?.uses||''))continue;
        found++;
        const version=String(step.with?.['node-version']||'').trim();
        const setupMajor=Number(version.split('.')[0]);
        if(!Number.isFinite(setupMajor)||setupMajor<20)errors.push(p+' must use Node 20 or newer for setup-node');
      }
    }
  }
  if(!found)errors.push('No Node setup configured');
  return errors;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const errors=verifyReleaseContract();
 if(errors.length){for(const error of errors)console.error(error);process.exitCode=1}
 else console.log('PASS: Node >=20 with supported Node 20+ build selectors');
}
